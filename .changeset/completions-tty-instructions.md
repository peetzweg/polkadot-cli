---
"polkadot-cli": patch
---

fix(completions): only print setup instructions when stdout is a TTY

`dot completions <shell>` wrote its setup hint to stderr on every invocation.
Inside `eval "$(dot completions zsh)"` in `~/.zshrc`, stderr bypasses the
command substitution and reaches the terminal, so every new shell printed the
`# Add this to your ~/.zshrc` block. The hint is now only printed when stdout
is a TTY — i.e. when a human runs the command to look at the script — and
stays silent when the output is captured by `eval` or redirected to a file.
