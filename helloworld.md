# PROJECT: VIRTUAL AI OFFICE
## Build a Fully Functional 3D AI Agent Workforce Simulation Platform

You are acting as a Principal Software Architect, Senior Full-Stack Engineer, AI Infrastructure Engineer, Game Developer, and Product Designer.

Your mission is to design and build a production-ready application called **Virtual AI Office**.

This is NOT a conventional AI chatbot dashboard.

This is a persistent, interactive, game-like 3D virtual office where multiple AI agents operate as virtual employees inside a simulated company.

The user acts as the CEO / Office Manager.

Each AI agent represents an employee with:
- A unique identity and character.
- A dedicated desk and workspace.
- A configurable AI model.
- A set of skills and capabilities.
- Assigned responsibilities.
- A working schedule.
- Break schedules.
- Task assignments.
- Real-time activity.
- Working history.
- Performance metrics.

The entire system should feel like managing a real technology company, except the employees are AI agents.

---

# 1. PRODUCT VISION

Create an immersive 3D virtual office where the user can:

1. Enter the office through a main entrance.
2. Walk around the office using keyboard controls.
3. Observe AI employees working at their desks.
4. See which agents are busy, idle, thinking, executing tools, resting, or offline.
5. Assign new tasks to employees.
6. Create new employees.
7. Configure employee skills and AI models.
8. Monitor their activities through their computer screens.
9. Open an employee profile to inspect their current work.
10. Observe collaboration between multiple agents.
11. Manage working hours and break schedules.
12. Monitor company-wide productivity.

The virtual office must not be just an animation.

Every visual activity must reflect actual backend execution states.

For example:
- If an agent is executing a real task, its character should appear to be working.
- If an agent has no assigned tasks, it should appear idle.
- If an agent is waiting for another agent, it should appear to be waiting.
- If an agent is using a tool, the activity panel should show the actual tool being executed.
- If an agent finishes a task, it should transition into an idle state.

The simulation must be driven by real application data.

# 2. 3D OFFICE ENVIRONMENT

Build a fully interactive 3D office environment inspired by modern simulation games, Roblox-style interaction, and management games.

Use:
- Three.js.
- React Three Fiber.
- Drei.
- React.
- TypeScript.

The environment should include:

## Office Layout

Create a modern technology company office with:

1. Main entrance.
2. Reception area.
3. CEO office.
4. Open workspace.
5. Individual employee desks.
6. Meeting room.
7. Break room.
8. Kitchen.
9. Server / DevOps room.
10. Collaboration area.
11. Rest area.
12. Optional outdoor area.

Use a modular environment so the office can expand over time.

## Employee Characters

Each AI employee must have a visible 3D character.

Characters should have:
- Unique appearance.
- Name label.
- Role label.
- Current status indicator.
- Assigned desk.
- Idle animation.
- Walking animation.
- Sitting animation.
- Working animation.
- Thinking animation.
- Break animation.

Use lightweight 3D models and animations.

Avoid unnecessarily expensive rendering.

Use instancing, optimized assets, and level-of-detail techniques when appropriate.

## Camera and Movement

Implement:

- WASD movement.
- Arrow key movement.
- Mouse camera rotation.
- Mouse wheel zoom.
- Third-person camera.
- Optional isometric camera.
- Collision detection.
- Walkable navigation areas.
- Interactive objects.
- Click-to-interact.

The user should be able to walk from the entrance to any employee's desk.

The user must be able to click an employee to inspect them.

## Interaction

When approaching an employee:
- Display an interaction prompt.
- Allow opening employee details.
- Allow opening their computer monitor.
- Allow assigning a task.
- Allow sending a direct instruction.
- Allow opening their activity history.

When clicking a computer monitor, open a detailed workstation interface.

# 3. AI EMPLOYEE MANAGEMENT

Build a complete employee management system.

Every employee must have the following properties:

- Employee ID.
- Employee name.
- Avatar.
- Job title.
- Department.
- Description.
- AI provider.
- AI model.
- API credential reference.
- System instructions.
- Skills.
- Tools.
- Permissions.
- Working hours.
- Break schedule.
- Desk assignment.
- Current status.
- Current task.
- Performance history.
- Creation date.

## Employee Creation

Allow the CEO to create new employees through an interface.

Example:

Name: Alex
Role: Senior DevOps Engineer
Department: Infrastructure
Model: Claude Sonnet
Skills:
- Docker
- Linux
- Kubernetes
- Nginx
- PostgreSQL
- Cloudflare
- CI/CD

System instruction:

"You are a senior DevOps engineer responsible for maintaining infrastructure, monitoring production servers, troubleshooting incidents, and optimizing deployment pipelines."

The employee should automatically receive a character and a desk in the office.

Allow editing, duplicating, disabling, and deleting employees.

# 4. MULTI-MODEL AI PROVIDER SYSTEM

This is one of the most important requirements.

The application must support multiple AI providers through a unified provider abstraction.

Support:

- Anthropic Claude.
- Google Gemini.
- OpenAI GPT.
- DeepSeek.
- OpenRouter.
- Compatible OpenAI API endpoints.
- Other providers through extensible adapters.

Do not tightly couple employee logic to a specific AI provider.

Create a provider abstraction layer.

Suggested architecture:

AIProvider
- generateResponse()
- streamResponse()
- executeToolCall()
- getAvailableModels()
- validateCredentials()
- getUsage()
- getModelCapabilities()

Each employee should be independently configurable.

Example:

Alex:
Provider: Anthropic
Model: Claude Sonnet

Sarah:
Provider: Google
Model: Gemini

David:
Provider: DeepSeek
Model: DeepSeek Chat

Michael:
Provider: OpenRouter
Model: Selected OpenRouter model

Allow the user to:
- Add provider credentials.
- Configure multiple API keys.
- Select models.
- Change models without recreating employees.
- Configure temperature and token limits.
- Set model-specific parameters.
- Test provider connectivity.
- Monitor token usage.
- Monitor API costs.

Store API credentials securely.

Never expose API keys in frontend code or browser responses.

Use encrypted credential storage and server-side provider calls.

Implement retry policies, timeout handling, rate limits, and provider failure handling.

# 5. SKILLS SYSTEM

Build a modular skill system inspired by modern AI Agent Skills and DevOps skill architectures.

A skill is a reusable capability that can be assigned to one or multiple employees.

Examples:

## DevOps Skills
- Docker Management.
- Linux Administration.
- Nginx Configuration.
- PostgreSQL Optimization.
- Kubernetes.
- Cloudflare.
- CI/CD.
- Server Monitoring.
- Incident Response.
- Security Auditing.

## Frontend Skills
- React Development.
- Vue Development.
- Next.js.
- TailwindCSS.
- UI/UX Implementation.
- Accessibility.
- Performance Optimization.
- Browser Testing.

## Backend Skills
- Node.js.
- NestJS.
- Express.
- REST API Design.
- GraphQL.
- Prisma.
- PostgreSQL.
- Redis.
- Authentication.

## QA Skills
- Unit Testing.
- Integration Testing.
- E2E Testing.
- Bug Investigation.
- Regression Testing.

## General Skills
- Web Research.
- Documentation.
- Technical Writing.
- Project Planning.
- Code Review.
- Task Decomposition.

Each skill should contain:
- Name.
- Description.
- Instructions.
- Version.
- Required permissions.
- Required tools.
- Dependencies.
- Optional reference files.
- Execution configuration.

Support importing skills from local directories or compatible skill repositories.

Where practical, support SKILL.md-based definitions.

Employees can have multiple skills.

Allow skill assignment, removal, editing, and version management.

Skills must be loaded into the agent execution context when relevant.

Do not blindly load every skill into every model request. Use skill selection based on task relevance.

# 6. TOOL AND INTEGRATION SYSTEM

Agents should be able to execute real tools.

Create a centralized tool registry.

Examples:

- Terminal.
- Shell commands.
- File operations.
- Git.
- GitHub.
- Browser automation.
- Web search.
- HTTP requests.
- PostgreSQL queries.
- Docker operations.
- SSH.
- API integrations.
- Custom tools.

Each tool must have:
- Name.
- Description.
- Input schema.
- Execution handler.
- Permission requirements.
- Timeout.
- Audit logging.

Implement granular permissions.

For example:

DevOps Agent:
- Can inspect server status.
- Can read Docker logs.
- Can inspect Nginx configuration.
- Cannot delete production databases without approval.

Frontend Agent:
- Can read project files.
- Can modify frontend files.
- Can run build commands.
- Cannot access production secrets.

Destructive operations must require explicit approval.

Never execute arbitrary agent-generated shell commands without permission checks and isolation.

# 7. TASK MANAGEMENT AND WORK SIMULATION

Build a real task management and orchestration system.

The CEO should be able to create tasks.

Example:

Task:
"Investigate why production API response time increased."

Description:
"Check server resource usage, PostgreSQL performance, Docker logs, and Nginx configuration. Identify the bottleneck and prepare a report."

The CEO can:
- Assign a task to one employee.
- Assign a task to multiple employees.
- Set priority.
- Set deadlines.
- Set dependencies.
- Add descriptions.
- Attach files.
- Provide context.
- Cancel tasks.
- Pause tasks.
- Retry failed tasks.

Task lifecycle:

CREATED
→ QUEUED
→ ASSIGNED
→ ACCEPTED
→ PLANNING
→ EXECUTING
→ WAITING
→ REVIEW
→ COMPLETED

Additional states:
- FAILED.
- CANCELLED.
- PAUSED.
- BLOCKED.

Each transition must be stored in the database.

## Agent Execution

When an employee receives a task:

1. Load employee configuration.
2. Load relevant skills.
3. Load authorized tools.
4. Load task context.
5. Ask the selected AI model to plan the task.
6. Generate an execution plan.
7. Execute the task step by step.
8. Record each action.
9. Stream activity to the frontend.
10. Save results and artifacts.
11. Mark the task as completed or failed.

Agents should be able to request human approval when necessary.

Do not simulate task completion.

An employee must only report completion when the underlying execution has actually completed.

# 8. REAL-TIME ACTIVITY MONITORING

Every employee must have a live activity feed.

Example:

Alex — DevOps Engineer

10:02:01 — Received task.
10:02:05 — Analyzing infrastructure.
10:02:15 — Executing docker ps.
10:02:19 — Reading container logs.
10:02:32 — Inspecting PostgreSQL connections.
10:03:10 — Generating incident report.

The activity feed must show actual execution events.

Support:
- Real-time streaming.
- Tool execution details.
- AI response streaming.
- Current execution step.
- Errors.
- Warnings.
- Approval requests.
- Token usage.
- Execution duration.

Use WebSocket or Server-Sent Events.

The CEO must be able to open an employee's workstation and inspect their current task.

# 9. EMPLOYEE WORKSTATION INTERFACE

Every desk should have an interactive computer monitor.

Clicking the monitor opens a dedicated workstation interface.

The interface should contain:

### Screen 1: Overview
- Employee profile.
- Current status.
- Current task.
- Model information.
- Skills.
- Performance.

### Screen 2: Terminal
Display actual tool execution output.

For example:

$ docker ps

CONTAINER ID   IMAGE       STATUS
abc123         postgres    Up 3 hours
def456         redis       Up 3 hours

Terminal output must come from actual tool execution.

### Screen 3: Activity
A chronological event timeline.

### Screen 4: AI Conversation
Show the actual conversation between the orchestration system and the selected AI model.

### Screen 5: Tasks
Show assigned, completed, pending, and failed tasks.

### Screen 6: Files
Display files generated or modified during execution.

### Screen 7: Performance
- Tokens consumed.
- Estimated API cost.
- Execution time.
- Success rate.
- Tasks completed.

Allow the CEO to send an additional instruction to an employee while they are working.

# 10. REALISTIC OFFICE SCHEDULE

The office must simulate realistic working hours.

Allow configuration of:

- Company timezone.
- Opening time.
- Closing time.
- Working days.
- Lunch break.
- Morning break.
- Afternoon break.
- Custom holidays.

Example:

Working hours:
09:00 - 18:00

Morning break:
10:30 - 10:45

Lunch:
12:00 - 13:00

Afternoon break:
15:30 - 15:45

When an employee enters break:
- Change their status to ON_BREAK.
- Stop assigning new tasks.
- Pause execution only if the task supports safe pausing.
- Move their character to the break room.
- Play an appropriate animation.

Important:
Do not interrupt a running task abruptly.

If a task cannot be safely paused, allow the agent to finish its current safe execution step before going on break.

When the break ends, the employee returns to their desk.

If outside working hours, employees should be marked OFFLINE or OFF_DUTY.

Allow overtime configuration.

Allow individual schedules per employee.

# 11. EMPLOYEE MOVEMENT AND AUTONOMOUS BEHAVIOR

Employees should not remain static.

Implement a state-driven movement system.

Examples:

IDLE:
Employee sits at their desk and occasionally performs idle animations.

WORKING:
Employee sits at their workstation and types.

THINKING:
Employee pauses and displays a thinking animation.

TOOL_EXECUTING:
Employee works while the monitor displays execution activity.

WAITING:
Employee waits for a dependency or external response.

ON_BREAK:
Employee walks to the break room and rests.

IN_MEETING:
Employee walks to the meeting room.

COLLABORATING:
Two or more agents move to a collaboration area.

OFFLINE:
Employee leaves the office or becomes unavailable.

Movement should be connected to real application state.

Do not randomly display fake productivity animations.

Minor idle animations are acceptable as cosmetic behavior.

Use a navigation system such as NavMesh or an equivalent pathfinding implementation.

# 12. MULTI-AGENT COLLABORATION

Support multiple employees working together on complex projects.

Example:

CEO assigns:

"Build a complete authentication module."

The orchestration system can divide the task:

Project Manager:
- Analyze requirements.
- Create subtasks.
- Assign responsibilities.

Backend Engineer:
- Design database schema.
- Implement authentication API.

Frontend Engineer:
- Implement login and registration UI.

QA Engineer:
- Test authentication flows.
- Report bugs.

Code Reviewer:
- Review implementation.
- Identify security issues.

Each employee should operate independently using their own configured model and skills.

Support:
- Task delegation.
- Dependencies.
- Shared task context.
- Agent-to-agent communication.
- Shared project files.
- Collaboration events.
- Review and approval.

Agents must not endlessly delegate tasks to one another.

Implement delegation limits, execution budgets, recursion protection, and timeouts.

# 13. CEO DASHBOARD

Create a management dashboard outside the 3D environment.

The dashboard should display:

Company overview:
- Total employees.
- Active employees.
- Idle employees.
- Employees on break.
- Offline employees.
- Active tasks.
- Completed tasks.
- Failed tasks.
- Pending approvals.

Productivity:
- Tasks completed today.
- Average task duration.
- Success rate.
- Total tokens consumed.
- Estimated AI spending.
- Model usage distribution.

Live activity:
- Recently executed actions.
- Recent completed tasks.
- Current incidents.
- Approval requests.

The CEO should be able to switch between:
1. 3D Office.
2. Dashboard.
3. Employees.
4. Tasks.
5. Skills.
6. AI Providers.
7. Tools.
8. Analytics.
9. Settings.

# 14. DATABASE ARCHITECTURE

Use PostgreSQL.

Design a normalized, extensible schema.

Suggested entities:

- users
- companies
- departments
- employees
- employee_skills
- skills
- skill_versions
- ai_providers
- ai_models
- credentials
- employee_tools
- tools
- employee_schedules
- break_schedules
- office_locations
- desks
- tasks
- task_assignments
- task_dependencies
- task_events
- agent_sessions
- agent_messages
- agent_execution_steps
- tool_executions
- approvals
- artifacts
- usage_records
- audit_logs
- office_events

Use Prisma ORM.

Implement:
- Proper indexes.
- Foreign keys.
- Transactions.
- Pagination.
- Soft deletion where appropriate.
- Database migrations.

Avoid storing large execution logs directly in frequently queried employee records.

# 15. SYSTEM ARCHITECTURE

Design the application with clearly separated responsibilities.

Suggested architecture:

Frontend:
- React.
- TypeScript.
- Vite or Next.js.
- TailwindCSS.
- React Three Fiber.
- Drei.
- Zustand or another appropriate state manager.

Backend:
- NestJS.
- TypeScript.
- REST API.
- WebSocket Gateway.
- Prisma.
- PostgreSQL.
- Redis.

Background execution:
- BullMQ or an equivalent job queue.
- Dedicated AI execution workers.
- Tool execution workers.
- Scheduled jobs.

AI infrastructure:
- Provider adapters.
- Model registry.
- Skill loader.
- Agent runtime.
- Tool registry.
- Context management.
- Execution orchestrator.

Storage:
- PostgreSQL for structured data.
- Redis for queues and transient state.
- S3-compatible object storage for artifacts.

Architecture should support horizontal scaling.

Do not run long-running AI tasks directly inside HTTP request handlers.

# 16. SECURITY AND RELIABILITY

This application will eventually interact with real servers, code repositories, databases, and infrastructure.

Security is mandatory.

Implement:
- Authentication.
- Role-based access control.
- Encrypted provider credentials.
- Tool-level authorization.
- Approval workflows.
- Execution sandboxing.
- SSH credential isolation.
- Audit logs.
- Rate limiting.
- Agent execution limits.
- Token budgets.
- Cost limits.
- Timeouts.
- Retry policies.
- Cancellation support.
- Error recovery.

Agents must never have unrestricted access to production infrastructure.

Use isolated execution environments for potentially dangerous tools.

Require explicit human confirmation for destructive operations.

# 17. VISUAL DESIGN DIRECTION

The visual experience is extremely important.

The application should feel like a premium simulation game combined with a professional enterprise management platform.

3D environment:
- Modern technology office.
- Warm ambient lighting.
- Realistic furniture.
- Large windows.
- Workstations.
- Plants.
- Meeting rooms.
- Animated characters.
- Interactive computer screens.

Visual references:
- Roblox-style character interaction.
- The Sims-style employee simulation.
- Modern management simulation games.
- Premium 3D isometric office environments.

Avoid childish or overly cartoonish aesthetics.

The office should look professional, polished, and enjoyable.

Management dashboard:
- Clean enterprise UI.
- Modern typography.
- Clear data hierarchy.
- Excellent dark and light mode support.
- Responsive design.

Use subtle transitions and animations.

# 18. IMPORTANT FUNCTIONAL RULES

These rules must be followed throughout development.

1. The 3D office is a visualization of the real backend state, not a separate fake simulation.
2. Every employee must have a real AI execution configuration.
3. Every task must have a persistent execution record.
4. Every tool action must be logged.
5. Employee status must be synchronized with real execution states.
6. AI provider selection must be independent per employee.
7. Skills must be reusable across employees.
8. Working schedules must affect task assignment.
9. Break schedules must be respected.
10. Employees must not pretend to perform work when no task is running.
11. The application must recover from worker crashes.
12. The CEO must be able to inspect and control every employee.
13. The system must be extensible for new AI providers, tools, skills, and employee types.
14. Never hardcode mock employee data as if it were production data.
15. Clearly distinguish demo data from real execution data.

# 19. IMPLEMENTATION STRATEGY

Do not attempt to build everything in one unstructured implementation.

First inspect the existing repository and understand its architecture.

Then produce:

1. System architecture.
2. Database ERD.
3. Module structure.
4. API specification.
5. AI provider abstraction design.
6. Agent execution lifecycle.
7. 3D environment architecture.
8. Security model.
9. Implementation roadmap.

After architecture approval, implement the application in phases.

## Phase 1 — Foundation
- Project setup.
- Database.
- Authentication.
- AI provider registry.
- Employee CRUD.
- Skill CRUD.
- Basic task management.

## Phase 2 — AI Execution Engine
- Provider adapters.
- Agent runtime.
- Skill loading.
- Tool registry.
- Background execution.
- Task lifecycle.
- Real-time activity streaming.

## Phase 3 — 3D Office
- Office environment.
- Characters.
- Desks.
- Navigation.
- Camera.
- Keyboard movement.
- Click interactions.
- Employee status visualization.

## Phase 4 — Workstation
- Interactive computer monitors.
- Live terminal.
- Agent activity.
- Conversations.
- Task history.
- Generated artifacts.

## Phase 5 — Workforce Simulation
- Working schedules.
- Break schedules.
- Autonomous movement.
- Meetings.
- Collaboration.
- Agent delegation.

## Phase 6 — Enterprise Management
- CEO dashboard.
- Analytics.
- Usage tracking.
- Cost monitoring.
- Approval workflows.
- Audit logs.
- Performance optimization.

# 20. ACCEPTANCE CRITERIA

The application is not considered complete merely because the UI looks good.

The following scenarios must work end-to-end.

SCENARIO A — Entering the Office

1. User logs in.
2. User enters the 3D office.
3. User starts at the main entrance.
4. User can walk around.
5. User sees employee characters at their desks.
6. Employee statuses reflect actual backend states.

SCENARIO B — Creating an Employee

1. User creates a DevOps employee.
2. User selects Claude as the provider.
3. User selects a model.
4. User assigns DevOps skills.
5. User configures working hours.
6. Employee receives a desk and character.
7. Employee appears in the 3D office.

SCENARIO C — Assigning Work

1. User assigns a server troubleshooting task.
2. Employee accepts the task.
3. Agent runtime loads the relevant skills.
4. Claude receives the task context.
5. Agent executes authorized tools.
6. Real execution events appear in the activity feed.
7. Character changes to working state.
8. The computer monitor displays real activity.
9. Employee completes the task.
10. Results are saved.
11. Employee returns to idle state.

SCENARIO D — Switching Models

1. User changes an employee from Claude to Gemini.
2. Existing employee configuration remains intact.
3. Next execution uses Gemini.
4. Previous task history remains accessible.

SCENARIO E — Break Time

1. Working schedule reaches lunch break.
2. Employee stops accepting new work.
3. Employee safely completes or pauses current work.
4. Character walks to the break room.
5. Status changes to ON_BREAK.
6. Employee returns to the desk after the break.

SCENARIO F — Multi-Agent Collaboration

1. CEO assigns a complex project.
2. Project is divided into subtasks.
3. Different agents receive responsibilities.
4. Agents execute using their individual models and skills.
5. Agents share task context.
6. Dependencies are respected.
7. Final results are assembled and reviewed.

SCENARIO G — Failure Recovery

1. AI provider becomes unavailable.
2. Agent execution records the error.
3. Employee changes to an appropriate waiting or failed state.
4. The system does not falsely report completion.
5. Retry or manual intervention is available.

---

# FINAL DEVELOPMENT INSTRUCTIONS

Think like a product engineer building a real commercial product, not a developer creating a visual prototype.

Prioritize:
- Correct architecture.
- Real AI execution.
- Extensibility.
- Security.
- Reliable state management.
- Immersive 3D experience.
- Excellent user experience.

Before coding, inspect the repository and report your architecture proposal.

Do not unnecessarily rewrite existing project infrastructure.

Do not sacrifice backend functionality for visual effects.

Do not use fake activity to make the office appear busy.

Build the system incrementally, test every major feature, and ensure that every simulated employee action is connected to actual application state.

The final result should feel like a real virtual company where the CEO can walk into the office, observe employees, assign work, monitor execution, and manage an entire AI-powered workforce.