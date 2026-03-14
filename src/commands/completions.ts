import type { CAC } from "cac";

const ZSH_SCRIPT = `\
_dot_completions() {
  local -a completions
  local current_word="\${words[CURRENT]}"
  local preceding=("\${words[@]:1:CURRENT-1}")

  # Build args: -- <current_word> <preceding_words...>
  local args=("__complete" "--" "\${current_word}")
  args+=("\${preceding[@]}")

  completions=("\${(@f)$(dot "\${args[@]}" 2>/dev/null)}")

  local has_dot=0
  for comp in "\${completions[@]}"; do
    if [[ "$comp" == *. ]]; then
      has_dot=1
      break
    fi
  done

  if (( has_dot )); then
    compadd -S '' -- "\${completions[@]}"
  else
    compadd -- "\${completions[@]}"
  fi
}

compdef _dot_completions dot`;

const BASH_SCRIPT = `\
_dot_completions() {
  local current_word="\${COMP_WORDS[COMP_CWORD]}"
  local preceding=("\${COMP_WORDS[@]:1:COMP_CWORD-1}")

  # Build args: -- <current_word> <preceding_words...>
  local args=("__complete" "--" "\${current_word}")
  args+=("\${preceding[@]}")

  local IFS=$'\\n'
  local completions
  completions=($(dot "\${args[@]}" 2>/dev/null))

  local has_dot=0
  for comp in "\${completions[@]}"; do
    if [[ "$comp" == *. ]]; then
      has_dot=1
      break
    fi
  done

  if (( has_dot )); then
    compopt -o nospace
  fi

  COMPREPLY=("\${completions[@]}")
}

complete -F _dot_completions dot`;

const FISH_SCRIPT = `\
function __dot_complete
  set -l tokens (commandline -opc)
  set -l current (commandline -ct)

  set -l args "__complete" "--" "$current"
  for t in $tokens[2..-1]
    set -a args "$t"
  end

  dot $args 2>/dev/null
end

complete -c dot -f -a '(__dot_complete)'`;

const SETUP_INSTRUCTIONS: Record<string, string> = {
  zsh: `# Add this to your ~/.zshrc:
#   eval "$(dot completions zsh)"
# Then restart your shell or run: source ~/.zshrc`,
  bash: `# Add this to your ~/.bashrc:
#   eval "$(dot completions bash)"
# Then restart your shell or run: source ~/.bashrc`,
  fish: `# Save this to ~/.config/fish/completions/dot.fish:
#   dot completions fish > ~/.config/fish/completions/dot.fish`,
};

const SCRIPTS: Record<string, string> = {
  zsh: ZSH_SCRIPT,
  bash: BASH_SCRIPT,
  fish: FISH_SCRIPT,
};

export function registerCompletionsCommand(cli: CAC) {
  cli
    .command("completions <shell>", "Generate shell completion script (zsh, bash, fish)")
    .action((shell: string) => {
      const script = SCRIPTS[shell];
      if (!script) {
        console.error(
          `Unsupported shell "${shell}". Supported: ${Object.keys(SCRIPTS).join(", ")}`,
        );
        process.exit(1);
      }

      // Print setup instructions to stderr so they don't pollute the script
      const instructions = SETUP_INSTRUCTIONS[shell];
      if (instructions) {
        process.stderr.write(`${instructions}\n`);
      }

      // Print the script to stdout
      console.log(script);
    });
}
