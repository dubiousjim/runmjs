#!/usr/bin/env node --experimental-modules --experimental-wasm-modules
// #!/usr/bin/env deno run --allow-read --

/* if your kernel can't handle multiple shebang arguments:
 * 1. use env -S ... from GNU coreutils or FreeBSD
 * 2. or make the shebang line: #!/bin/sh
 *    and the second line:      'exec' //"$(type -P node)" --experimental-modules --experimental-wasm-modules "$0" "$@"
 *                     or:      'exec' //"$(type -P deno)" run --allow-read "$0" -- "$@"
 */

function _main(runnerpath, _scriptpath, args, exit, host) {
  return (async () => {
    let realpath, cwd, read;
    if (host === 'deno') {
      realpath = Deno.realpathSync;
      cwd = Deno.cwd;
      const decoder = new TextDecoder('utf-8');
      read = function (p) {
        return decoder.decode(Deno.readFileSync(p));
      }
    } else {
      const fs = await import('fs');
      const path = await import('path');
      realpath = path.resolve;
      cwd = process.cwd;
      read = function (p) {
        return fs.readFileSync(path.normalize(p), 'utf8');
      }
    }
    const scriptpath = realpath(_scriptpath);
    const client = await import(scriptpath);
    const { opts, usage, validate, main } = client;
    opts.unknown = function(o) { if (o.startsWith('-')) { usage(scriptpath); return exit(1); }};
    const processedOpts = parseOptions(args, opts);
    const files = processedOpts._;
    delete processedOpts._;
    if (!validate(processedOpts, files)) {
      usage(scriptpath);
      return exit(1);
    }
    return main(processedOpts, files, {read, exit, realpath, cwd: cwd(), host, script: scriptpath});
  })();
}



if (typeof process === 'object') {
  // node
  if (process.argv[0].endsWith('/node') && import.meta.url == 'file://' + process.argv[1])
    _main(process.argv[1], process.argv[2], process.argv.slice(3), process.exit, 'node');
} else if (typeof Deno === 'object') {
  // deno executable in Deno.execPath()
  if (import.meta.main)
    _main(location && location.pathname, Deno.args[0], Deno.args.slice(1), Deno.exit, 'deno'); // or combine with [location.pathname, ...Deno.args]
}



// based on minimist and https://deno.land/std/flags
// generated from: "https://deno.land/std/flags/mod.ts"
// using: tsc -t ES2019 deno_flags.ts
function isNumber(x) {
    if (typeof x === 'number') return true;
    if (/^0x[0-9a-f]+$/i.test(String(x))) return true;
    return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(String(x));
}

function hasKey(obj, keys) {
    let o = obj;
    keys.slice(0, -1).forEach(function (key) {
        o = (get(o, key) || {});
    });
    const key = keys[keys.length - 1];
    return key in o;
}

function get(obj, key) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
        return obj[key];
    }
}

function parseOptions(args, initialOptions) {
    const options = {
        ...DEFAULT_OPTIONS,
        ...(initialOptions || {})
    };
    const flags = {
        bools: {},
        strings: {},
        unknownFn: options.unknown,
        allBools: false
    };
    if (options.boolean !== undefined) {
        if (typeof options.boolean === 'boolean') {
            flags.allBools = !!options.boolean;
        }
        else {
            const booleanArgs = typeof options.boolean === 'string'
                ? [options.boolean]
                : options.boolean;
            booleanArgs.filter(Boolean).forEach((key) => {
                flags.bools[key] = true;
            });
        }
    }
    const aliases = {};
    if (options.alias !== undefined) {
        for (const key in options.alias) {
            const val = get(options.alias, key);
            if (typeof val === 'string') {
                aliases[key] = [val];
            }
            else {
                aliases[key] = val;
            }
            for (const alias of get(aliases, key)) {
                aliases[alias] = [key].concat(aliases[key].filter((y) => alias !== y));
            }
        }
    }
    if (options.string !== undefined) {
        const stringArgs = typeof options.string === 'string' ? [options.string] : options.string;
        stringArgs.filter(Boolean).forEach(function (key) {
            flags.strings[key] = true;
            const alias = get(aliases, key);
            if (alias) {
                alias.forEach((alias) => {
                    flags.strings[alias] = true;
                });
            }
        });
    }
    const defaults = options.default;
    const argv = { _: [] };
    function argDefined(key, arg) {
        return ((flags.allBools && /^--[^=]+$/.test(arg)) ||
            get(flags.bools, key) ||
            !!get(flags.strings, key) ||
            !!get(aliases, key));
    }
    function setKey(obj, keys, value) {
        let o = obj;
        keys.slice(0, -1).forEach(function (key) {
            if (get(o, key) === undefined) {
                o[key] = {};
            }
            o = get(o, key);
        });
        const key = keys[keys.length - 1];
        if (get(o, key) === undefined ||
            get(flags.bools, key) ||
            typeof get(o, key) === 'boolean') {
            o[key] = value;
        }
        else if (Array.isArray(get(o, key))) {
            o[key].push(value);
        }
        else {
            o[key] = [get(o, key), value];
        }
    }
    function setArg(key, val, arg = undefined) {
        if (arg && flags.unknownFn && !argDefined(key, arg)) {
            if (flags.unknownFn(arg) === false)
                return;
        }
        const value = !get(flags.strings, key) && isNumber(val) ? Number(val) : val;
        setKey(argv, key.split('.'), value);
        (get(aliases, key) || []).forEach(function (x) {
            setKey(argv, x.split('.'), value);
        });
    }
    function aliasIsBoolean(key) {
        return get(aliases, key).some(function (x) {
            return get(flags.bools, x);
        });
    }
    Object.keys(flags.bools).forEach(function (key) {
        setArg(key, defaults[key] === undefined ? false : defaults[key]);
    });
    let notFlags = [];
    // all args after '--' are not parsed
    if (args.indexOf('--') !== -1) {
        notFlags = args.slice(args.indexOf('--') + 1);
        args = args.slice(0, args.indexOf('--'));
    }
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (/^--.+=/.test(arg)) {
            // Using [\s\S] instead of . because js doesn't support the
            // 'dotall' regex modifier. See:
            // http://stackoverflow.com/a/1068308/13216
            const m = arg.match(/^--([^=]+)=([\s\S]*)$/);
            const key = m[1];
            const value = m[2];
            if (flags.bools[key]) {
                const booleanValue = value !== 'false';
                setArg(key, booleanValue, arg);
            }
            else {
                setArg(key, value, arg);
            }
        }
        else if (/^--no-.+/.test(arg)) {
            const key = arg.match(/^--no-(.+)/)[1];
            setArg(key, false, arg);
        }
        else if (/^--.+/.test(arg)) {
            const key = arg.match(/^--(.+)/)[1];
            const next = args[i + 1];
            if (next !== undefined &&
                !/^-/.test(next) &&
                !get(flags.bools, key) &&
                !flags.allBools &&
                (get(aliases, key) ? !aliasIsBoolean(key) : true)) {
                setArg(key, next, arg);
                i++;
            }
            else if (/^(true|false)$/.test(next)) {
                setArg(key, next === 'true', arg);
                i++;
            }
            else {
                setArg(key, get(flags.strings, key) ? '' : true, arg);
            }
        }
        else if (/^-[^-]+/.test(arg)) {
            const letters = arg.slice(1, -1).split('');
            let broken = false;
            for (let j = 0; j < letters.length; j++) {
                const next = arg.slice(j + 2);
                if (next === '-') {
                    setArg(letters[j], next, arg);
                    continue;
                }
                if (/[A-Za-z]/.test(letters[j]) && /=/.test(next)) {
                    setArg(letters[j], next.split('=')[1], arg);
                    broken = true;
                    break;
                }
                if (/[A-Za-z]/.test(letters[j]) &&
                    /-?\d+(\.\d*)?(e-?\d+)?$/.test(next)) {
                    setArg(letters[j], next, arg);
                    broken = true;
                    break;
                }
                if (letters[j + 1] && letters[j + 1].match(/\W/)) {
                    setArg(letters[j], arg.slice(j + 2), arg);
                    broken = true;
                    break;
                }
                else {
                    setArg(letters[j], get(flags.strings, letters[j]) ? '' : true, arg);
                }
            }
            const key = arg.slice(-1)[0];
            if (!broken && key !== '-') {
                if (args[i + 1] &&
                    !/^(-|--)[^-]/.test(args[i + 1]) &&
                    !get(flags.bools, key) &&
                    (get(aliases, key) ? !aliasIsBoolean(key) : true)) {
                    setArg(key, args[i + 1], arg);
                    i++;
                }
                else if (args[i + 1] && /^(true|false)$/.test(args[i + 1])) {
                    setArg(key, args[i + 1] === 'true', arg);
                    i++;
                }
                else {
                    setArg(key, get(flags.strings, key) ? '' : true, arg);
                }
            }
        }
        else {
            if (!flags.unknownFn || flags.unknownFn(arg) !== false) {
                argv._.push(flags.strings['_'] || !isNumber(arg) ? arg : Number(arg));
            }
            if (options.stopEarly) {
                argv._.push(...args.slice(i + 1));
                break;
            }
        }
    }
    Object.keys(defaults).forEach(function (key) {
        if (!hasKey(argv, key.split('.'))) {
            setKey(argv, key.split('.'), defaults[key]);
            (aliases[key] || []).forEach(function (x) {
                setKey(argv, x.split('.'), defaults[key]);
            });
        }
    });
    if (options['--']) {
        argv['--'] = [];
        notFlags.forEach(function (key) {
            argv['--'].push(key);
        });
    }
    else {
        notFlags.forEach(function (key) {
            argv._.push(key);
        });
    }
    return argv;
}

const DEFAULT_OPTIONS = {
    unknown: (i) => i,
    boolean: false,
    alias: {},
    string: [],
    default: {},
    '--': false,
    stopEarly: true,
};


