// generate-sprite-css.js
import fs from "fs";
import path from "path";

const sheet = "/assets/icons.png";   // your sprite sheet
const cssOut = "icons.css";          // output CSS (global)
const htmlOut = "preview.html";      // preview HTML
const cssModuleOut = "Icon.module.css";
const tsxOut = "Icon.tsx";

// sprite sheet setup
const iconWidth = 32;        // width of one icon
const iconHeight = 32;       // height of one icon
const sheetWidth = 256;      // total width of sheet
const sheetHeight = 256;     // total height of sheet
const classPrefix = "icon";

// optional names, left→right, top→bottom
const names = [
    "budget",
    "law",
    "secret",
    "opportunity",
    "needle",
    "reject",
    "clock",
    "minus",
    "plus",
    "approve",
    "meet",
    "news",
    "street",
    "shop",
    "charisma",
    "checked",
    "unchecked",
    // …extend this as needed
];

const cols = Math.floor(sheetWidth / iconWidth);
const rows = Math.floor(sheetHeight / iconHeight);

//
// 1) Build global CSS
//
let css = `
.${classPrefix} {
  background-image: url('${sheet}');
  background-repeat: no-repeat;
  display: inline-block;
  width: ${iconWidth}px;
  height: ${iconHeight}px;
}
`;

//
// 2) Build CSS Module
//
let cssModule = `
.${classPrefix} {
  background-image: url('${sheet}');
  background-repeat: no-repeat;
  display: inline-block;
  width: ${iconWidth}px;
  height: ${iconHeight}px;
}
`;

//
// 3) Build HTML preview
//
let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Sprite Preview</title>
<link rel="stylesheet" href="${cssOut}">
<style>
body { font-family: sans-serif; padding: 20px; background-color: brown; }
.grid { display: flex; flex-wrap: wrap; gap: 10px; }
.item { text-align: center; width: ${iconWidth + 20}px; }
.item span { display: block; margin: 0 auto; }
.name { font-size: 12px; margin-top: 4px; }
</style>
</head>
<body>
<h1>Sprite Preview</h1>
<div class="grid">
`;

//
// 4) Loop through grid and generate classes
//
let count = 0;
for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
        const posX = -(x * iconWidth);
        const posY = -(y * iconHeight);
        const name = names[count] || `i${count}`; // fallback safe name

        // add to global css
        css += `
.${classPrefix}-${name} {
  background-position: ${posX}px ${posY}px;
}
`;

        // add to css module
        cssModule += `
.${classPrefix}-${name} {
  background-position: ${posX}px ${posY}px;
}
`;

        // add to preview
        html += `
  <div class="item">
    <span class="${classPrefix} ${classPrefix}-${name}"></span>
    <div class="name">${name}</div>
  </div>
`;

        count++;
    }
}

html += `
</div>
</body>
</html>
`;

//
// 5) Build Icon.tsx
//
const typeUnion = names.map(n => `"${n}"`).join(" | ") || "string";

const tsx = `import React from "react";
import styles from "./${path.basename(cssModuleOut)}";

export type IconType = ${typeUnion};

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  type: IconType;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({ type, className = "", ...props }) => {
  const classes = [styles.icon, styles[\`\${styles.icon}-\${type}\`], className].filter(Boolean).join(" ");
  return <span className={classes} {...props} />;
};
`;

//
// Write files
//
fs.writeFileSync(cssOut, css);
fs.writeFileSync(htmlOut, html);
fs.writeFileSync(cssModuleOut, cssModule);
fs.writeFileSync(tsxOut, tsx);

console.log(`Generated: \${count} classes in \${cssOut} - Preview saved to \${htmlOut} - CSS Module saved to \${cssModuleOut}- React component saved to \${tsxOut}\``);
