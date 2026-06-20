import { cpSync, mkdirSync, rmSync } from "node:fs";

const out = new URL("../dist/", import.meta.url);

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const path of ["index.html", "src", "examples"]) {
  cpSync(new URL(`../${path}`, import.meta.url), new URL(`./${path}`, out), {
    recursive: true
  });
}

console.log("build-static: wrote dist/");
