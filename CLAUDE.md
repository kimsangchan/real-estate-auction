# AI Assistant Coding Guidelines

이 프로젝트의 구현 규칙·스택·네비게이션은 아래 import로 불러온다.

@AGENTS.md

## Karpathy-Style Behavioral Guidelines

These guidelines follow the widely circulated `karpathy-guidelines.mdc` pattern for reducing common LLM coding mistakes. They are not treated as a replacement for project-specific instructions.

## Think Before Coding

- Do not assume silently.
- State assumptions explicitly when they affect the implementation.
- If multiple interpretations exist, present the options instead of choosing silently.
- If a simpler approach exists, say so and explain the trade-off.
- If something is unclear, stop, name what is confusing, and ask.

## Simplicity First

- Write the minimum code that solves the problem.
- Do not add features beyond what was asked.
- Do not create abstractions for single-use code.
- Do not add flexibility, configurability, or error handling for scenarios that are not real requirements.
- If a solution is much longer than it needs to be, simplify it.
- Ask whether a senior engineer would call the solution overcomplicated. If yes, reduce it.

## Surgical Changes

- Touch only what is necessary.
- Clean up only unused imports, variables, functions, or files created by the current change.
- Do not improve adjacent code, comments, or formatting opportunistically.
- Do not refactor working code unless the task requires it.
- Match the existing style, even when a different style would be preferred.
- If unrelated dead code is noticed, mention it instead of deleting it.
- Every changed line should trace directly to the user's request.

## Goal-Driven Execution

- Define success criteria before implementation.
- Convert vague tasks into verifiable goals.
- For validation work, write invalid-input tests first when feasible.
- For bug fixes, reproduce the bug with a failing test first when feasible.
- For refactors, verify tests before and after when feasible.
- For multi-step tasks, state a short plan with a verification check for each step.
- Continue until the result is verified or the blocker is clearly reported.

## Maximize Prompt Caching

- Prefix consistency matters. Assume any change to past shared context can break cache reuse.
- Keep stable instructions stable. Do not edit `AGENTS.md` or `CLAUDE.md` for temporary emphasis.
- Keep static content before dynamic content. Do not put current time, session IDs, temporary task state, or changing variables in persistent instruction files.
- Put session-specific updates in the current user message instead of rewriting root instructions.
- For temporary rule emphasis, use a `<system-reminder>` block in the user message.
- Avoid unnecessarily repeating large code blocks, documents, or unchanged context.
- Prefer concise summaries and file references over reprinting full files.
- Avoid avoidable tool/model/config churn during long sessions when it would break cache locality.

## Workflow Rules

- Answer in Korean when the user writes in Korean.
- When answering in Korean, end sentences naturally with periods instead of trailing colons.
- When creating a new source file, add a one-line top comment describing the file's role.
- Before claiming code changes are complete, run the relevant tests or clearly state why tests could not be run.
- Prefer documentation-first planning for large design decisions, then implement in small verified increments.
