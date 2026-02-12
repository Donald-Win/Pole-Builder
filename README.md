# XARM Pole Builder

Overhead line crossarm configurator and pick list generator. Built as a Progressive Web App (PWA) for offline field use.

## Live App

**URL:** https://donald-win.github.io/Pole-Builder/

Install as a PWA on your phone/tablet by tapping "Add to Home Screen" when prompted.

---

## Development Setup

### Prerequisites
- Node.js 18+ and npm

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```

App will be available at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

Output will be in the `dist/` directory.

---

## Deployment to GitHub Pages

### Option 1: Automated (GitHub Actions)
1. Push changes to the `main` branch
2. GitHub Actions will automatically build and deploy to `gh-pages` branch
3. Site will be live at https://donald-win.github.io/Pole-Builder/ within 1-2 minutes

### Option 2: Manual Deploy
```bash
npm run deploy
```

This builds the app and pushes to the `gh-pages` branch.

**First-time setup:**
1. Make sure GitHub Pages is enabled in repo settings
2. Set source to `gh-pages` branch, `/` (root) directory
3. Run `npm run deploy`

---

## PWA Features

- **Offline Support:** App caches all assets and works without internet
- **Installable:** Can be installed as a standalone app on mobile devices
- **Auto-Updates:** Service worker updates automatically when new version is deployed

---

## Project Structure

```
pole-builder/
├── public/             # Static assets (icons, manifest)
├── src/
│   ├── App.jsx        # Main XARM configurator component
│   ├── main.jsx       # React entry point
│   └── index.css      # Styles
├── index.html         # HTML template
├── vite.config.js     # Vite + PWA configuration
└── package.json       # Dependencies and scripts
```

---

## Technology Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library
- **Workbox** - Service worker / offline caching
- **GitHub Pages** - Hosting

---

## Configuration Notes

### Base Path
The app is configured for GitHub Pages subdirectory deployment at `/Pole-Builder/`. If you change the repo name, update the `base` path in `vite.config.js`.

### Icons
Replace placeholder icons in `public/icon-192.png` and `public/icon-512.png` with your own 192×192 and 512×512 PNG files.

### Offline Caching
The service worker caches all static assets. To force cache refresh during development, use Chrome DevTools > Application > Service Workers > Unregister.
