# Sample Outputs Placeholder

Run the tool against these five repos and save each result as `{owner}-{name}.json`:

| Repo | Expected Difficulty |
|------|-------------------|
| `https://github.com/nestjs/nest` | Advanced |
| `https://github.com/c2siorg/Webiu` | Intermediate |
| `https://github.com/nicedoc/nicedoc.io` | Beginner |
| `https://github.com/facebook/react` | Advanced |
| `https://github.com/sindresorhus/awesome` | Beginner |

## How to generate samples

```bash
cd task-2-analyzer/backend
pip install -r requirements.txt
uvicorn main:app --port 8000 &

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
  }' | python -m json.tool > sample-outputs/analysis-$(date +%Y%m%d).json
```

Save individual repo JSON files too:
- `nestjs-nest.json`
- `c2siorg-Webiu.json`
- `nicedoc-niceodcio.json`
- `facebook-react.json`
- `sindresorhus-awesome.json`
