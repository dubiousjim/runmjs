## RunMJS ##

Install `runmjs.mjs` in your `$HOME/lib/`. Adjust its shebang line to use your
favored host (node or deno).

Then you can write ES JavaScript modules that work as shell scripts, which will
work the same no matter which of those host was selected. (Assuming they only
require access to the small api provided by runmjs.)

These modules don't have to sort out the different ways to do things on node vs
deno. They only need to provide four exports like these:

```
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
```




(See file `sample1.mjs` for these examples.)

Name your ES JavaScript module something like `foo.mjs`, add the following two
lines to its top:

```
#!/bin/sh
//$HOME/lib/runmjs.mjs "$0" "$@"; exit 0
```

and make it executable. Then you can run it as a script.

Sample output:

```
$ ./sample1.mjs --long1 arg1 --long4=arg4 --long6 --long8 empty.txt README.md

host is node
cwd is /Users/jim/repo/runmjs
abs path to your script is /Users/jim/repo/runmjs/sample1.mjs
{
  long1: 'arg1', a: 'arg1',
  long3: 'default_long3'
  long4: 'arg4',
  long6: true, c: true,
  long7: false, d: false,
  long8: true,
  long9: false,
} [ 'empty.txt', 'README.md' ]
empty.txt 0
README.md 1342
```

Options like `--long2`, `--long5` with no default will be omitted from the
result if they weren't specified on the command line.

The option parsing is extracted from Deno's
[std/flags](https://deno.land/std/flags/README.md), which in turn is based on
[minimist](https://github.com/substack/minimist).

