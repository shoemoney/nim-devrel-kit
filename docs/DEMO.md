# 🎬 The 5 minute demo

This is the presenter's talk track for `scripts/demo.sh`. Five acts, five minutes of talking, one repo. Every command here is a command the script runs.

## ✅ Before you walk in

- [ ] `NVIDIA_API_KEY` is exported in this terminal. Read it silently with `read -rsp 'NVIDIA API key: ' NVIDIA_API_KEY; echo; export NVIDIA_API_KEY`.
- [ ] `npm install` is done. Act 5 starts the MCP tool server, which needs the SDK.
- [ ] `bash scripts/demo.sh --offline` has run once on this machine. This is your no-Wi-Fi fallback, and it needs no key.
- [ ] `DEMO_PAUSE=1` is set if you want to step between acts with Enter. Use a large terminal font.

## ⏱️ Timing

| Act | Time | Command | The one sentence to say |
|---|---|---|---|
| 1. First call | 0:45 | `node quickstart/node/quickstart.mjs` | "A developer goes from nothing to a streamed answer in one file, with no installs." |
| 2. Benchmark | 1:00 | `node router/nim-route.mjs bench` | "Speed claims go stale, so the kit measures them on the spot." |
| 3. Failover | 1:00 | `node router/nim-route.mjs route --no-bench` | "A rate limit and a retired model are handled, and the request still gets an answer." |
| 4. Route for real | 1:15 | `node router/nim-route.mjs route` | "The router ranks by what it just measured and sends the prompt to the fastest healthy model." |
| 5. Agent | 1:00 | `node agent/agent.mjs "..."` | "The model checks the facts with tools instead of guessing from memory." |

Total: 5:00 of talking. The demo itself takes under 20 seconds of wall time against hosted NIM (12 and 16 seconds in two runs on 2026-11-21).

## Act 1: first call 🟢

**Run**

```sh
node quickstart/node/quickstart.mjs
```

**Say**

This is a developer who has never called NIM. The file has no dependencies, so there is nothing to install. It asks the live catalog which models exist, picks the first of NVIDIA's small models that is listed, and streams the answer. The last line shows the model it used, plus time to first token and total time, measured right here.

**Point at** the text arriving word by word, and the last line `model=... ttft_ms=... total_ms=...`. The model id came from `GET /v1/models`, not a hard-coded string.

**If it breaks**

- A 401 means the key is not exported in this terminal. Export it again.
- No network: in a second pane run `node local/mock-nim.mjs --port 8089`, then `NIM_BASE_URL=http://127.0.0.1:8089/v1 NIM_MODEL=mock/fast node quickstart/node/quickstart.mjs`. The model must be set, because the mock lists no preferred id.

## Act 2: benchmark 📊

**Run**

Hosted:

```sh
node router/nim-route.mjs bench --runs 2 --max-tokens 128
```

Offline:

```sh
node router/nim-route.mjs bench --runs 2 --max-tokens 128 --models mock/fast,mock/slow,mock/flaky
```

**Say**

Speed claims go stale every time a catalog or a model changes, so the kit measures. Each model gets streamed runs, and the table reports time to first token and tokens per second as medians, with the min and max beside each one. This is a short two-run pass, so it will not match the five-run snapshot exactly. That is expected.

**Point at** the median TTFT column with its min to max range, and the `errors` column. A failing model shows up there and the table still prints.

**If it breaks**

- If the network drops mid-run, run the offline command.
- To show measured numbers with no live call: `node scripts/render-results.mjs bench/results/2026-11-21-nemotron-hosted.json`.

## Act 3: failover 🛟

**Run**

The demo always runs this act on the mock, so the failures repeat every time:

```sh
NIM_BASE_URL=http://127.0.0.1:8089/v1 node router/nim-route.mjs route --no-bench \
  --models mock/busy,mock/retired,mock/fast --prompt "Who served this request?"
```

If you run it by hand, start the mock first with `node local/mock-nim.mjs --port 8089`.

**Say**

Real traffic hits three kinds of failure. One model is rate limited, so the router parks it for a minute. Another has been retired, so the router drops it for the rest of the session and never retries it. The third model answers. The route log shows what happened to each one.

**Point at**

The route log:

```json
[{"model":"mock/busy","error":429,"parked":true},{"model":"mock/retired","error":410,"gone":true},{"model":"mock/fast","served":true}]
```

Then open the `Router` class in `router/nim-route.mjs`. The 410 branch and the 429 branch are the two checks in its catch block.

**If it breaks**

This act is already offline and repeatable. If it fails, another program is probably using port 8089. Set `MOCK_PORT` to a free port and run the demo again.

## Act 4: route for real 🏁

**Run**

Hosted:

```sh
node router/nim-route.mjs route --runs 1 --prompt "In two sentences: why does time to first token matter for a voice agent?"
```

Offline:

```sh
node router/nim-route.mjs route --runs 1 --models mock/fast,mock/slow,mock/flaky \
  --prompt "In two sentences: why does time to first token matter for a voice agent?"
```

**Say**

Now the router ranks the models by what it just measured, then sends the prompt to the fastest healthy one and streams the answer. It is the same code path that failed over in act 3. The new part is that the ranking comes from live timings.

**Point at** the `Served by` line with its TTFT and tokens per second, and the route log.

**If it breaks** a parked model is skipped and the next one answers. If every model fails, the router says so honestly. Run the offline command and move on.

## Act 5: the agent 🤖

**Run**

Hosted:

```sh
node agent/agent.mjs "Is meta/llama-3.1-8b-instruct still available? If not, which small NVIDIA Nemotron model should I use for a tool-calling agent? Check that your pick is alive and supports tools."
```

Offline:

```sh
node agent/agent.mjs "Is mock/retired still available?" --model mock/fast
```

**Say**

This is the last act. The model does not answer from memory. It calls tools over MCP, reads what they return, and then writes the answer. Here it checked a model that NVIDIA has retired. The tool returned HTTP 410 with the end-of-life date, the agent quoted that date, and then it checked a current alternative.

**Point at**

- The `Step` lines, which show the model for each turn.
- The `🔧` lines: the tool name, its arguments and how long the call took.
- In the live run, four tool calls: `check_model`, `list_models`, `check_model`, `supports_tools`.

**If it breaks**

- A malformed tool call comes back as an error the model can correct. If the hosted run stalls, `--max-steps` bounds it.
- The offline act exercises the loop with canned responses. It proves the plumbing, not the model's judgment. Say so if someone asks.

---

## ❓ Questions this demo answers

### 1. How do you get a developer to a first successful call fast?

The three quickstarts in `quickstart/` do the same four things: list models, pick a preferred chat model from the catalog, call it and print the timings. The Node one has no dependencies. `scripts/smoke-quickstart.sh` runs all three, and on 2026-11-21 the wall times were 0.53 s for curl, 0.78 s for Python and 0.54 s for Node. Hand the developer whichever matches their stack.

### 2. How do you handle model deprecation and rate limits?

The `Router` class in `router/nim-route.mjs` sorts errors into three groups. A 410 marks the model gone for the session, and it is never retried. A 429, a 5xx or a timeout parks the model for 60 seconds, or for the `Retry-After` value if the server sends one. Other 4xx errors are raised straight away, because switching models does not fix a bad request or a bad key. Act 3 shows the first two in one route log: one model parked, one gone, and the third serves the request.

### 3. How would you help a partner move from hosted to on-prem or a workstation?

The client code does not change. Only `NIM_BASE_URL` changes, and `NIM_MODEL` if the ids differ. `local/README.md` has the one-line swap, and `local/docker-compose.yml` has the self-hosted container recipe. I would have the partner run `node router/nim-route.mjs models` against their own server first, because the model list and the capacity limits belong to their setup.

### 4. What is your hands-on experience with NIM, CUDA, TensorRT-LLM or Triton?

Honest answer: my own hardware is Apple Silicon, and I run local models there with MLX. The hosted NIM work in this repo is real and measured on 2026-11-21, and the raw runs are in `bench/results/`. The self-hosted NIM container recipe in `local/docker-compose.yml` is written from NVIDIA's documentation. I have not run it on an NVIDIA GPU, and I have not run CUDA, TensorRT-LLM or Triton on one for this kit. I am a contributor to NeMo.

<!-- GPU-RUN -->

### 5. How do agents and tool calling fit in?

The agent in `agent/agent.mjs` lets Nemotron pick tools, then runs them over MCP. The server in `agent/mcp-server.mjs` has four tools: `list_models`, `check_model`, `measure_model` and `supports_tools`. Each one makes a real API call, so the answers come from the live service. The loop also has a fixed floor in code. It returns an unknown tool or bad JSON to the model as an error, and it stops after three identical calls in a row.

### 6. How do you measure and report performance honestly?

The raw runs are in `bench/results/`, not only the medians. The methodology sits next to the table: one client, five sequential runs per model, one fixed prompt, a shared public endpoint and one time of day. Time to first token counts reasoning deltas too. The min and max are printed beside every median, so an outlier stays visible: one nano-omni run of five spiked to 1107 ms on the shared endpoint, and the table shows it. The tables come from `scripts/render-results.mjs`, so no one retypes a number.

### 7. What would you build next with a partner?

I would start with whatever their developers keep asking about. The options are a reference integration in a real app, a sample they can fork, a tutorial, or a workshop built from this demo with a timed exercise per act. The README roadmap lists what is planned, and I have not promised anything beyond it.

### 8. Which local runtimes does this work with?

`local/README.md` lists four OpenAI-compatible targets: Ollama, vLLM, the llama.cpp server and the MLX LM server. It also lists the self-hosted NIM container and the offline mock. I have run the MLX path on Apple Silicon with the same benchmark command, and the offline mock runs in the tests. The others are listed targets I have not benchmarked. Tool calling depends on the model and the server, so check it before you promise it.

### 9. How do you turn developer friction into product feedback?

Building this kit turned up three real problems. `GET /v1/models` has no type field, so chat models can only be found by probing them. `meta/llama-3.1-8b-instruct` still appears in tutorials, and it now returns HTTP 410 with an end-of-life date. Some catalog entries return 404 for chat. In one probe on 2026-11-21, 13 of the 33 catalog entries answered a chat completion inside the timeout (the capture is in `bench/results/2026-11-21-catalog-probe.md`). Each finding is something a product team can act on.

### 10. Why small models first?

The default order puts NVIDIA's own small models first: `bolt-e4b`, then `lightning-30b-a3b`, then `nano-omni`. The list is always intersected with the live catalog. In the hosted run, those three had median TTFT between 121 and 179 ms, while the 550B model measured 472 ms. Tool calling worked on all five Nemotron chat models I tested, so the order is a size choice: the smallest model that does the job goes first, because that is the one a developer can also run on a workstation or at the edge. It is not a speed ranking. In this snapshot `lightning` had the lowest median TTFT (121 ms) and `bolt` the lowest total time for a short answer. When speed is the goal, `route` ranks by what it just measured.

---

## 🔢 Numbers you can quote

Hosted NIM, Nemotron chat models, measured 2026-11-21. Five runs per model, one at a time, `max_tokens` 256, temperature 0.2, one fixed prompt.

| model | ok | median TTFT ms | TTFT min to max | median tok/s | tok/s min to max | median total ms | median out tokens | errors |
|---|---|---|---|---|---|---|---|---|
| nvidia/nemotron-3.5-bolt-e4b | 5/5 | 179 | 178 to 269 | 88.7 | 88.2 to 89.3 | 915 | 65.0 | - |
| nvidia/nemotron-3.5-lightning-30b-a3b | 5/5 | 121 | 119 to 140 | 185.2 | 105.0 to 196.1 | 1503 | 256.0 | - |
| nvidia/nemotron-3-nano-omni-30b-a3b-reasoning | 5/5 | 138 | 114 to 1107 | 85.0 | 63.0 to 89.8 | 3185 | 256.0 | - |
| nvidia/nemotron-3.5-super-vl-120b-a12b | 5/5 | 376 | 348 to 885 | 129.5 | 62.6 to 160.6 | 2352 | 256.0 | - |
| nvidia/nemotron-3-ultra-550b-a55b | 5/5 | 472 | 455 to 2267 | 37.3 | 20.5 to 37.9 | 3992 | 132.0 | - |

Also worth quoting:

- The full five-act demo ran in 12 and 16 seconds of wall time in two runs against hosted NIM on 2026-11-21 (`bench/results/2026-11-21-demo-run.txt`).
- Quickstart wall times on 2026-11-21: curl 0.52 s, Python 0.82 s, Node 0.55 s.

**This is a snapshot.** It is one client, one time of day, one shared public endpoint and five runs per model. Say so every time you quote it. The raw runs are in `bench/results/2026-11-21-nemotron-hosted.json`, and the full methodology is in the README.
