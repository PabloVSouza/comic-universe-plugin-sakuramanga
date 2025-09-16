<div align="center">
  <img src="https://github.com/pablovsouza/comic-universe/blob/main/src/renderer/assets/icon.svg?raw=true" width="200">
  <h1>Comic Universe Plugin - SakuraManga</h1>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" />
  <a href="https://github.com/prisma/prisma/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" /></a>
  <a href="https://discord.gg/gPsQkDGDfc"><img alt="Discord" src="https://img.shields.io/discord/1270554232260526120?label=Discord"></a>
  <br />
  <br />
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/pablovsouza/comic-universe/">Main Project</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://www.instagram.com/opablosouza/">Instagram</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://discord.gg/gPsQkDGDfc">Discord</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://x.com/opablosouza">X (Twitter)</a>
  <br />
  <hr />
</div>

## What is this?

This is a plugin for [**Comic Universe**](https://github.com/pablovsouza/comic-universe) that enables reading manga from **sakuramangas.org**.

The plugin provides a web scraping interface to browse, search, and read manga from SakuraManga's website directly within the Comic Universe app.

## ✨ Features (v1.0.0)

- **Browse manga** - Get latest manga from the homepage
- **Search functionality** - Find manga by title
- **Detailed information** - Synopsis, genres, author, and status
- **Chapter listings** - Complete chapter lists with proper sorting  
- **Page reading** - Full manga page image support
- **Flexible scraping** - Multiple selector patterns for robust parsing
- **Error handling** - Graceful fallbacks when specific patterns fail

### How to install this plugin?

1. **Download the plugin package**:
   - Download the latest `.tgz` file from the [releases page](https://github.com/PabloVSouza/comic-universe-plugin-sakuramanga/releases)
   - Or clone this repository and run `npm run build` to generate the package

2. **Install in Comic Universe**:
   Comic Universe (version 2.0+) looks for plugins in the following folder:
   - **macOS**: `~/library/application-support/comic-universe/plugins`
   - **Windows**: `%appdata%/comic-universe/plugins`

3. **Extract the plugin**:
   - Extract the plugin folder to the plugins directory
   - The app should automatically recognize and load the plugin

### Development

To modify or contribute to this plugin:

```bash
git clone https://github.com/PabloVSouza/comic-universe-plugin-sakuramanga.git
cd comic-universe-plugin-sakuramanga
npm install
npm run build
```

### What if i'm stuck?

Feel free to reach me on the social networks provided above, as well as in our discord server.

### I'm done developing my plugin, how do i publish it?

Reach me in the discord server, on the channel **#plugin-submission**.
