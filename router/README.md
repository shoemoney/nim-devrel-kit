# Benchmark and route NIM chat requests

Requires Node 20 or newer. Set `NVIDIA_API_KEY` to your key from
https://build.nvidia.com. All subcommands accept `--base URL`; local
OpenAI-compatible servers may run without a key.

List the current catalog, or classify it with tiny chat requests:

```sh
node router/nim-route.mjs models
node router/nim-route.mjs models --probe --concurrency 6
```

The catalog can contain models that do not accept chat completions.
Probe reports `chat`, `gone`, `rate-limited`, `not-chat`, or `error`.
A gone row includes the server's end-of-life detail.

Benchmark the preferred models that are still listed:

```sh
node router/nim-route.mjs bench --runs 5 --max-tokens 256 --out results.json
node router/nim-route.mjs bench --models nvidia/nemotron-3.5-bolt-e4b --runs 2
node router/nim-route.mjs bench --all-chat --concurrency 3 --timeout-ms 120000
node scripts/render-results.mjs results.json
```

Runs within each model are sequential. Models run with limited concurrency.
Use `--prompt` to change the benchmark input. Results include TTFT, generation
rate, total time, output tokens, and failures. Missing usage is marked estimated;
its token count is the number of nonempty streamed deltas. JSON includes raw runs.
Missing catalog models are reported as skipped. A 410 stops that model's runs.
Reasoning models may need `--max-tokens 512` or more to reach visible content.

Benchmark quickly, rank by median TTFT, then stream a prompt:

```sh
node router/nim-route.mjs route --prompt 'Say hi in five words.' --runs 1
node router/nim-route.mjs route --models nvidia/nemotron-3.5-bolt-e4b --no-bench --prompt 'Hello'
```

`--no-bench` uses `--models` as an explicit ranked order. `--out` and `--label` need a benchmark run, so `route --no-bench` rejects them. The CLI prints the
served model's timings and the route log after streaming the answer.

The router parks a model temporarily on 429, 5xx, timeout, or network failure.
Parking lasts 60 seconds by default, or the server's Retry-After seconds.
A 410 marks the model gone for the entire router session. It is never retried.
Other errors, including 400 and 401, rethrow immediately because switching
models will not reliably fix a bad request or credential.

Benchmark JSON records the hosted NVIDIA endpoint host, or `local` for other servers. Use `--label local-mlx` to override this label without recording a private address.
