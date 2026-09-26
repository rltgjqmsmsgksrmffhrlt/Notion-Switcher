# Fonts

`gowun-batang-{400,700}-subset.woff2` are subsets of **Gowun Batang** (SIL Open Font License 1.1, see `OFL.txt`),
used only for the storybook display type: the dashboard title and empty-state sentences (`--font-display`).

They contain only these characters, so the extension stays small:

```
 BNYabdefilmnoprstuy검결과비색숲아어없요음이있직
```

(the wordmark "Baobab" plus `emptyNoWorkspaces` and `emptyNoResults` in ko/en). A character outside the set
falls back to the next font in `--font-display`. When those strings change, regenerate the subsets from
`https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400&text=<chars>` (and `wght@700`) and download
the woff2 URLs it returns.
