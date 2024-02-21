import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import autoprefixer from "autoprefixer";
import babel from "rollup-plugin-babel";
import copy from "rollup-plugin-copy";
import livereload from "rollup-plugin-livereload";
import postcss from "rollup-plugin-postcss";
import serve from "rollup-plugin-serve";
import svelte from "rollup-plugin-svelte";
import { terser } from "rollup-plugin-terser";
import autoPreprocess from "svelte-preprocess";

const prod = !process.env.ROLLUP_WATCH;
const outputDir = "build";

export default {
  input: "src/index.ts",
  output: {
    dir: outputDir,
    format: "iife",
    sourcemap: !prod
  },

  plugins: [
    json(),
    babel({
      extensions: [".js", ".mjs", ".ts", ".html", ".svelte"],
      include: ["src/**/*.js", "src/**/*.ts"],
      exclude: ["node_modules/@babel/**"]
    }),
    resolve({
      browser: true,
      dedupe: ["svelte"],
      exportConditions: ["svelte"]
    }),

    postcss({
      extract: true,
      minimize: prod,
      use: ["sass"],
      plugins: [autoprefixer()]
    }),
    typescript(),
    commonjs(),

    svelte({
      preprocess: autoPreprocess(),
      compilerOptions: {
        dev: !prod
      }
    }),

    copy({ targets: [{ src: "static/*", dest: outputDir }] }),
    !prod &&
      serve({
        contentBase: "./build"
      }),
    !prod && livereload({ watch: outputDir }),

    prod &&
      terser({
        compress: true,
        mangle: true,
        output: {
          comments: false
        }
      })
  ]
};
