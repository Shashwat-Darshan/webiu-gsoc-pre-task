# Sample Outputs Placeholder

Run the analyzer against these public repositories and save each result as `{owner}-{name}.json`:

| Repo | Expected Difficulty |
|------|-------------------|
| `https://github.com/nestjs/nest` | Beginner or Intermediate (model-dependent) |
| `https://github.com/c2siorg/Webiu` | Beginner or Intermediate (model-dependent) |
| `https://github.com/nicedoc/nicedoc.io` | Beginner |
| `https://github.com/facebook/react` | Advanced or Intermediate (model-dependent) |
| `https://github.com/sindresorhus/awesome` | Beginner |

## How to generate samples

```bash
cd ../backend
npm install
npm run dev
```

In another terminal:

```bash
cd ../backend

curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "repos": [
      "https://github.com/nestjs/nest",
      "https://github.com/c2siorg/Webiu",
      "https://github.com/nicedoc/nicedoc.io",
      "https://github.com/facebook/react",
      "https://github.com/sindresorhus/awesome"
    ]
  }'
```

Save individual repo JSON files in this directory. Existing examples include:
- `nestjs-nest.json`
- `c2siorg-webiu.json`
- `nicedoc-nicedoc.io.json`
- `nicedoc-nicedoc-io.json`
- `facebook-react.json`
- `sindresorhus-awesome.json`

Notes:
- Small score differences between runs are possible due to live GitHub activity.
- If rate-limited, pass a GitHub token in the request body (`github_token`).
