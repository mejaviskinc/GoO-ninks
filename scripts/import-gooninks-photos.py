#!/usr/bin/env python3
"""Import user-provided GoO Ninks Drive photo folders as optimized, browseable static media.

Uses only public shared file IDs from scripts/gooninks-drive-photo-manifest.json.
The source folder does not encode a confirmed product SKU, so files remain
grouped by editorial shoot rather than being assigned to the wrong inventory row.
"""
import concurrent.futures
import io
import json
import os
import re
import sys
import tempfile
import time
import requests
from pathlib import Path

import gdown
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "scripts" / "gooninks-drive-photo-manifest.json"
OUTPUT = ROOT / "assets" / "gooninks-lookbook"
SIZE = (1050, 1420)
WEBP_QUALITY = 76
WORKERS = 2


def target_name(filename):
    slug = Path(filename).stem.lower()
    slug = re.sub(r"[^a-z0-9-]+", "-", slug).strip("-")
    if not slug:
        raise ValueError("Invalid source filename")
    return slug + ".webp"


def process(entry):
    group_id, index, file_id, name = entry
    final = OUTPUT / group_id / target_name(name)
    if final.is_file() and final.stat().st_size > 4000:
        return (group_id, index, name, final, "cached")
    final.parent.mkdir(parents=True, exist_ok=True)
    error_message = "Unknown download error"
    for attempt in range(1, 6):
        with tempfile.TemporaryDirectory(prefix="gn-drive-") as scratch:
            original = Path(scratch) / "source.jpg"
            try:
                # The shared Drive links have been tested in GitHub Actions.
                result = None
                try:
                    result = gdown.download(id=file_id, output=str(original), quiet=True)
                except Exception as exc:
                    print(f"gdown exception for {name}: {str(exc)[:100]}", flush=True)
                if not result or not original.is_file():
                    # Google sometimes rate-limits its older Drive link resolver.
                    # Use the official direct download host as a fallback.
                    direct = "https://drive.usercontent.google.com/download"
                    with requests.get(direct, params={
                        "id": file_id, "export": "download", "confirm": "t"
                    }, timeout=80, stream=True) as response:
                        response.raise_for_status()
                        content_type = response.headers.get("content-type", "")
                        if "text/html" in content_type:
                            raise RuntimeError("Drive returned an HTML permission/quota page")
                        with open(original, "wb") as out:
                            for chunk in response.iter_content(1024 * 256):
                                if chunk:
                                    out.write(chunk)
                if not original.is_file():
                    raise RuntimeError("Public Drive download returned no file")
                with Image.open(original) as source:
                    image = ImageOps.exif_transpose(source)
                    image = image.convert("RGB")
                    image.thumbnail(SIZE, Image.Resampling.LANCZOS)
                    temporary = final.with_suffix(".tmp")
                    image.save(temporary, format="WEBP", quality=WEBP_QUALITY, method=5)
                if temporary.stat().st_size < 4000:
                    raise RuntimeError("Compressed output unexpectedly small")
                os.replace(temporary, final)
                return (group_id, index, name, final, "downloaded")
            except Exception as exc:
                error_message = str(exc)
                try:
                    final.with_suffix(".tmp").unlink(missing_ok=True)
                except OSError:
                    pass
                if attempt < 5:
                    time.sleep((attempt ** 2) * 3)
    raise RuntimeError(f"Session {group_id}, {name} ({file_id}): {error_message}")


def main():
    raw = json.loads(SOURCE.read_text(encoding="utf-8"))
    expected = 322
    groups = raw["groups"]
    tasks = []
    path_names = set()
    for group in groups:
        for index, photo in enumerate(group["images"]):
            key = (group["id"], target_name(photo["original_name"]))
            if key in path_names:
                raise ValueError(f"Duplicate filename within a session: {key}")
            path_names.add(key)
            tasks.append((group["id"], index, photo["drive_id"], photo["original_name"]))
    if len(groups) != 6 or len(tasks) != expected:
        raise ValueError(f"Expected six sessions / {expected} images; found {len(groups)} / {len(tasks)}")
    print(f"Starting optimized import: {len(tasks)} photographs, {len(groups)} editorial sessions.", flush=True)

    records = []
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as executor:
        futures = {executor.submit(process, task): task for task in tasks}
        for done_index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            try:
                records.append(future.result())
            except Exception as exc:
                failures.append(str(exc))
                print("ERROR:", str(exc)[:250], flush=True)
            if done_index % 20 == 0 or done_index == len(tasks):
                print(f"Processed {done_index}/{len(tasks)}; failed {len(failures)}", flush=True)

    if failures:
        (OUTPUT / "import-failures.json").write_text(json.dumps(failures, indent=2), encoding="utf-8")
        print(f"Import incomplete, {len(failures)} photo(s) failed; not publishing an incomplete manifest.", file=sys.stderr)
        return 1

    by_group = {group["id"]: [] for group in groups}
    for group_id, idx, name, local_path, state in records:
        by_group[group_id].append((idx, name, local_path, state))

    public = {
        "version": 1,
        "title": "GoO Ninks Studio Photography",
        "total_photos": len(tasks),
        "groups": []
    }
    for group in groups:
        gid = group["id"]
        ordered = sorted(by_group[gid], key=lambda item: item[0])
        images = [
            {"src": f"/assets/gooninks-lookbook/{gid}/{p.name}", "original": name}
            for _, name, p, _ in ordered
        ]
        public["groups"].append({
            "id": gid,
            "title": f"Studio Session {gid}",
            "count": len(images),
            "cover": images[0]["src"],
            "images": images
        })
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "manifest.json").write_text(json.dumps(public, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    number = len(list(OUTPUT.rglob("*.webp")))
    print(f"Validated: {number} optimized WEBP files. Manifest: {sum(g['count'] for g in public['groups'])} images.")
    if number != expected:
        raise ValueError("Output count does not match expected count")
    return 0


if __name__ == "__main__":
    sys.exit(main())
