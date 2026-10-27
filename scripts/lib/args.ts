// Minimal command-line parsing: `--name value`, `--flag`, and positional words.
// Kept tiny on purpose so the scripts have no dependencies.

export type ParsedArgs = {
  positional: string[];
  options: Record<string, string | true>;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const options: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        options[name] = next;
        i++;
      } else {
        options[name] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, options };
}

export function stringOption(args: ParsedArgs, name: string): string | undefined {
  const value = args.options[name];
  return typeof value === "string" ? value : undefined;
}
