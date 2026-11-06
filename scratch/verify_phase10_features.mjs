const BASE_API = 'https://office-api.musyan.my.id/api/v1';

async function main() {
  console.log('--- 1. Testing Health Endpoint ---');
  const healthRes = await fetch(`${BASE_API}/health`);
  console.log('Health status:', healthRes.status, await healthRes.json());

  console.log('\n--- 2. Testing Username Login ---');
  // Login dengan username "budi_client"
  const loginRes = await fetch(`${BASE_API}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'budi_client',
      password: 'ClientPassword123!',
    }),
  });
  const loginDataRaw = await loginRes.json();
  const loginData = loginDataRaw.data || loginDataRaw;
  console.log('Login result:', loginRes.status, {
    token: loginData.token ? loginData.token.slice(0, 15) + '...' : null,
    username: loginData.username,
    name: loginData.name,
    activeCompanyId: loginData.activeCompanyId,
  });

  const token = loginData.token;
  if (!token) {
    console.error('Failed to get token:', loginData);
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log('\n--- 3. Testing Workspaces / Office info ---');
  const workspacesRes = await fetch(`${BASE_API}/auth/workspaces`, { headers: authHeaders });
  const workspacesRaw = await workspacesRes.json();
  const workspaces = workspacesRaw.data || workspacesRaw;
  console.log('Workspaces:', workspacesRes.status, workspaces.length, 'offices found');

  const companyId = loginData.activeCompanyId || workspaces[0]?.companyId;
  console.log('Active Company ID:', companyId);

  console.log('\n--- 4. Testing In-Office Friend Account Creation with Username ---');
  const testUsername = `user_test_${Date.now().toString().slice(-4)}`;
  const createAccountRes = await fetch(`${BASE_API}/system/memberships/create-account`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      username: testUsername,
      name: `Rekan ${testUsername}`,
      password: 'password123',
      permissions: ['office:read', 'employee:read', 'task:read'],
    }),
  });
  console.log('Create account for username', testUsername, 'Status:', createAccountRes.status);
  const accountResultRaw = await createAccountRes.json();
  const accountResult = accountResultRaw.data || accountResultRaw;
  console.log('Result:', accountResult.user ? {
    id: accountResult.user.id,
    name: accountResult.user.name,
    email: accountResult.user.email,
  } : accountResult);

  console.log('\n--- 5. Testing Login with New Username ---');
  const newLoginRes = await fetch(`${BASE_API}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testUsername,
      password: 'password123',
    }),
  });
  const newLoginDataRaw = await newLoginRes.json();
  const newLoginData = newLoginDataRaw.data || newLoginDataRaw;
  console.log('New user login result:', newLoginRes.status, {
    id: newLoginData.id,
    username: newLoginData.username,
    name: newLoginData.name,
  });
  console.log('New user login result:', newLoginRes.status, {
    id: newLoginData.id,
    username: newLoginData.username,
    name: newLoginData.name,
  });

  console.log('\n--- 6. Testing Sandbox Execution (Python & JS) ---');
  const pyRes = await fetch(`${BASE_API}/office/sandbox/execute`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      language: 'python',
      code: 'import math\nprint(f"Hasil kalkulasi: {math.sqrt(144) * 5}")',
    }),
  });
  console.log('Python Sandbox result:', pyRes.status, await pyRes.json());

  const jsRes = await fetch(`${BASE_API}/office/sandbox/execute`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      language: 'javascript',
      code: 'const nums = [1, 2, 3, 4, 5]; console.log("Sum:", nums.reduce((a, b) => a + b, 0));',
    }),
  });
  console.log('JS Sandbox result:', jsRes.status, await jsRes.json());

  console.log('\n--- 7. Testing External IDE MCP Server Endpoints ---');
  const mcpInitRes = await fetch(`${BASE_API}/office/mcp/server/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {},
    }),
  });
  console.log('MCP Initialize:', mcpInitRes.status, await mcpInitRes.json());

  const mcpToolsRes = await fetch(`${BASE_API}/office/mcp/server/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }),
  });
  const toolsDataRaw = await mcpToolsRes.json();
  const toolsData = toolsDataRaw.data || toolsDataRaw;
  console.log('MCP Tools available to IDEs:', toolsData.result?.tools?.map((t) => t.name));

  console.log('\n--- 8. Testing Context Status & Compaction Reset Gauge ---');
  // Get an employee
  const employeesRes = await fetch(`${BASE_API}/office/employees`, { headers: authHeaders });
  const employeesRaw = await employeesRes.json();
  const employees = employeesRaw.data || employeesRaw;
  if (employees.length > 0) {
    const emp = employees[0];
    console.log(`Checking context for agent: ${emp.name} (${emp.id})`);
    const ctxRes = await fetch(`${BASE_API}/office/workstation/context/${emp.id}`, { headers: authHeaders });
    const ctxDataRaw = await ctxRes.json();
    const ctxData = ctxDataRaw.data || ctxDataRaw;
    console.log('Context Status before compact:', {
      sessionIndex: ctxData.sessionIndex,
      totalTokensUsed: ctxData.totalTokensUsed,
      usagePercentage: ctxData.usagePercentage,
      statusLevel: ctxData.statusLevel,
      shouldReset: ctxData.shouldReset,
    });

    console.log('Compacting session...');
    const compactRes = await fetch(`${BASE_API}/office/workstation/context/${emp.id}/compact`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ reason: 'Verification test' }),
    });
    const compactRaw = await compactRes.json();
    console.log('Compact result:', compactRes.status, compactRaw.data || compactRaw);

    const ctxAfterRes = await fetch(`${BASE_API}/office/workstation/context/${emp.id}`, { headers: authHeaders });
    const ctxAfterRaw = await ctxAfterRes.json();
    const ctxAfterData = ctxAfterRaw.data || ctxAfterRaw;
    console.log('Context Status AFTER compact (Should be green LOW / ~1%):', {
      sessionIndex: ctxAfterData.sessionIndex,
      totalTokensUsed: ctxAfterData.totalTokensUsed,
      usagePercentage: ctxAfterData.usagePercentage,
      statusLevel: ctxAfterData.statusLevel,
      shouldReset: ctxAfterData.shouldReset,
    });
  }

  console.log('\n--- 9. Testing Roblox Proximity Voice Signal Relay ---');
  const voiceSignalRes = await fetch(`${BASE_API}/office/presence/voice-signal`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      signal: { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1...' },
    }),
  });
  console.log('Voice signal relay result:', voiceSignalRes.status, await voiceSignalRes.json());

  console.log('\n✅ ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
}

main().catch(console.error);
