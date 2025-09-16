<div align="center">
  <img src="https://github.com/pablovsouza/comic-universe/blob/main/src/renderer/assets/icon.svg?raw=true" width="200">
  <h1>Comic Universe Plugin Template</h1>
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

## What is this for?

This project is a base template for creating comic repositories for the app [**Comic Universe**](https://github.com/pablovsouza/comic-universe).

Feel free to fork this repository and start developing your own plugin, just following the typescript interfaces provided, as well as **being compatible with NPM**.

Please avoid using unnecessary dependencies, as it would make the main app heavier.

## ✨ Latest Updates (v0.1.0)

- **Updated TypeScript interfaces** to match Comic Universe 2.0+
- **Enhanced IComic interface** with new settings system for reading preferences
- **Per-comic customization** support for reading mode and direction
- **Improved type safety** with proper TypeScript 5.9+ support
- **Better plugin integration** with latest architecture

### How can i test the plugin?

Comic Universe (Only on version 2.0 onwards) will look for the folder called **plugins**, inside the **comic-universe** folder, on the following path:

- On Macs, its "**~/library/application-support/comic-universe/plugins**"
- On Windows, its "**%appdata%/comic-universe/plugins**"

Just put your plugin folder there and the app should recognize the files.

**Make sure to fill the package.json properly, so the app can use it's metadata.**

### What if i'm stuck?

Feel free to reach me on the social networks provided above, as well as in our discord server.

### I'm done developing my plugin, how do i publish it?

Reach me in the discord server, on the channel **#plugin-submission**.
