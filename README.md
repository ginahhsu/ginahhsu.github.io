# Gina Hsu — Portfolio

Static site, no build step. Plain HTML/CSS/JS so it can be hosted directly on GitHub Pages.

## Structure

- `index.html` — landing page markup
- `styles.css` — all styling
- `script.js` — card hover tilt + tab filtering (All / About / Projects / For fun)
- `assets/` — images used on the landing page

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploy to GitHub Pages

1. Create a new GitHub repo (e.g. `ginahsu.github.io` for a user site, or any name for a project site).
2. Push this folder's contents to the `main` branch.
3. In the repo settings, go to **Pages** and set the source to `Deploy from a branch` → `main` → `/ (root)`.
4. If using a project-site repo name (not `ginahsu.github.io`), your site will be published at `https://<username>.github.io/<repo-name>/`.
5. Optional: to use a custom domain (e.g. `ginahsu.co`), add a `CNAME` file at the repo root containing the domain, and configure DNS per [GitHub's custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
