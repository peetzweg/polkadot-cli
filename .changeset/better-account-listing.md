---
"polkadot-cli": patch
---

Improve unknown account error messages with readable multi-line listing and fuzzy match suggestions.

**Before:**

```
Error: Unknown account or address "people-sudo-signer".
  Available accounts: alice, bob, charlie, dave, eve, ferdie, people-paseo-sudo, pusd-faucet, ...
```

**After:**

```
Error: Unknown account or address "people-sudo-signer".
  Did you mean: people-paseo-sudo?
  Available accounts:
    - alice
    - bob
    - charlie
    - dave
    - eve
    - ferdie
    - people-paseo-sudo
    - pusd-faucet
    - ...
```

When the input is close to an existing account name, a "Did you mean?" hint is shown using Levenshtein distance matching (same fuzzy matching already used for pallets and calls). Available accounts are sorted alphabetically and listed one per line for easy scanning.
