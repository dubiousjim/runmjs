#!/bin/sh
//$HOME/lib/runmjs.mjs "$0" "$@"; exit 0

export const opts = {
  // options that always expect an argument
  string: ['long1', 'long2', 'long3', 'long4', 'long5'],

  // options that never expect an argument
  boolean: ['long6', 'long7', 'long8', 'long9'],

  // both long and short keys will be placed in result
  alias: { a:'long1', b:'long2', c:'long6', d:'long7' },

  default: { long3: 'default_long3' },
};

export function usage(script) {
  console.error('Usage: ' + script + ' [--long1=arg --long2=arg --long6 etc] files...');
}

export function validate(opts, files) {
  return files.length <= 2;
}

export function main(opts, files, api) {
  console.log("host is", api.host); // 'node' or 'deno'
  console.log("cwd is", api.cwd);
  console.log("abs path to your script is", api.script);
  // api also contains functions read, exit, realpath
  console.log(opts, files);
  for (const p of files) {
    const contents = api.read(p);
    console.log(p, contents.length);
  }
}

