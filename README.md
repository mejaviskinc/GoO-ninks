# GoO Ninks — Official Fashion Website (2026)

Static editorial storefront, 4 languages (`id`, `en`, `nl`, `ko`), catalog, cart and WhatsApp order confirmation. No server/database/payments. Product photos in the 2026 catalog are not mapped to individual SKU photos yet.

Target production domain: **https://gooninks.co.id/**

## GitHub Pages deployment

1. Repository Settings > Pages > Build and deployment > Source: **Deploy from a branch**, Branch: **main**, folder **/(root)**.
2. Custom domain: `gooninks.co.id` then Save. The CNAME file is included in the source.
3. On authoritative DNS (Hostinger hPanel if used as DNS manager), set `@` A records to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; set `www` CNAME to `mejaviskinc.github.io`.
4. Preserve MX/TXT/DKIM/SPF/DMARC mail records and any unrelated records. Remove only conflicting A/AAAA/CNAME for `@` or `www`.
5. When certificate is available, enable **Enforce HTTPS** in Pages settings.

Reference: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

## Maintenance

All site source files are at repository root: `index.html`, `styles.css`, `app.js`. No build step.
The first deployment uses one-time source unpack workflow in `.github/workflows/unpack.yml`. The workflow is inert once `site-source.b64` has been consumed and removed.
