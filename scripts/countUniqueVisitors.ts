import "dotenv/config";

const RAILWAY_API_URL = "https://backboard.railway.app/graphql/v2";
const PROJECT_NAME = "rinks-mtl";

interface RailwayProject {
  id: string;
  name: string;
}

interface RailwayLog {
  message: string;
  timestamp?: string;
}

interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

/**
 * Extracts IP address from a log line.
 * Handles IPv4-mapped IPv6 addresses (::ffff:xxx.xxx.xxx.xxx) by extracting the IPv4 part.
 */
function extractIpFromLine(line: string): string | null {
  const ipMatch = line.match(/IP:\s+(.+?)(?:\s+-|$)/);
  if (!ipMatch) {
    return null;
  }

  const ip = ipMatch[1].trim();

  // Handle IPv4-mapped IPv6 addresses (::ffff:xxx.xxx.xxx.xxx)
  if (ip.startsWith("::ffff:")) {
    return ip.replace("::ffff:", "");
  }

  return ip;
}

/**
 * Fetches the project ID for the given project name from Railway API.
 */
async function fetchProjectId(token: string): Promise<string> {
  const query = `
    query {
      projects {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;

  const response = await fetch(RAILWAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.statusText}`);
  }

  const result = (await response.json()) as GraphQLResponse<{
    projects: {
      edges: Array<{ node: RailwayProject }>;
    };
  }>;

  if (result.errors) {
    throw new Error(`GraphQL errors: ${result.errors.map((e) => e.message).join(", ")}`);
  }

  const project = result.data.projects.edges.find((edge) => edge.node.name === PROJECT_NAME);

  if (!project) {
    throw new Error(`Project "${PROJECT_NAME}" not found`);
  }

  return project.node.id;
}

/**
 * Filters logs to only include entries with the version marker.
 * This distinguishes logs from the new version that logs real client IPs.
 */
function filterLogsByVersion(
  logs: Array<{ message: string; timestamp?: string }>,
  versionMarker: string
): string[] {
  const filtered: string[] = [];

  for (const log of logs) {
    if (log.message.includes(versionMarker)) {
      filtered.push(log.message);
    }
  }

  return filtered;
}

/**
 * Fetches logs from Railway API for the given project ID.
 * Accesses logs through deployments.
 */
async function fetchLogs(
  token: string,
  projectId: string,
  versionMarker?: string
): Promise<string[]> {
  // Get deployments from the project
  const deploymentsQuery = `
    query($projectId: String!) {
      project(id: $projectId) {
        deployments {
          edges {
            node {
              id
              status
              createdAt
            }
          }
        }
      }
    }
  `;

  const deploymentsResponse = await fetch(RAILWAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: deploymentsQuery,
      variables: { projectId },
    }),
  });

  if (!deploymentsResponse.ok) {
    const errorText = await deploymentsResponse.text();
    throw new Error(
      `Failed to fetch deployments: ${deploymentsResponse.statusText} - ${errorText}`
    );
  }

  const deploymentsResult = (await deploymentsResponse.json()) as GraphQLResponse<{
    project: {
      deployments: {
        edges: Array<{
          node: {
            id: string;
            status: string;
            createdAt: string;
          };
        }>;
      };
    };
  }>;

  if (deploymentsResult.errors) {
    throw new Error(`GraphQL errors: ${deploymentsResult.errors.map((e) => e.message).join(", ")}`);
  }

  const deployments = deploymentsResult.data.project.deployments.edges;
  if (deployments.length === 0) {
    throw new Error("No deployments found for project");
  }

  // Collect logs from all deployments using the deploymentLogs query
  const allLogs: Array<{ message: string; timestamp?: string }> = [];

  for (const deploymentEdge of deployments) {
    const deploymentId = deploymentEdge.node.id;
    const deploymentStatus = deploymentEdge.node.status;

    // Use deploymentLogs as a top-level query
    const deploymentLogsQuery = `
      query($deploymentId: String!) {
        deploymentLogs(deploymentId: $deploymentId, limit: 1000) {
          message
          severity
          timestamp
        }
      }
    `;

    const deploymentLogsResponse = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: deploymentLogsQuery,
        variables: { deploymentId },
      }),
    });

    if (!deploymentLogsResponse.ok) {
      const errorText = await deploymentLogsResponse.text();
      console.warn(
        `Warning: Failed to fetch logs for deployment "${deploymentId}" (${deploymentStatus}): ${deploymentLogsResponse.statusText} - ${errorText}`
      );
      continue;
    }

    const deploymentLogsResult = (await deploymentLogsResponse.json()) as GraphQLResponse<{
      deploymentLogs: Array<{
        message: string;
        severity?: string;
        timestamp?: string;
      }>;
    }>;

    if (deploymentLogsResult.errors) {
      console.warn(
        `Warning: GraphQL errors for deployment "${deploymentId}": ${deploymentLogsResult.errors.map((e) => e.message).join(", ")}`
      );
      continue;
    }

    if (deploymentLogsResult.data?.deploymentLogs) {
      const deploymentLogs = deploymentLogsResult.data.deploymentLogs.map((log) => ({
        message: log.message,
        timestamp: log.timestamp,
      }));
      allLogs.push(...deploymentLogs);
    }
  }

  if (allLogs.length === 0) {
    throw new Error(
      "No logs found in any deployment. The logs query might not be available or the deployments might not have logs."
    );
  }

  // Filter by version marker if provided
  if (versionMarker) {
    const filtered = filterLogsByVersion(allLogs, versionMarker);
    console.log(
      `Filtered ${allLogs.length} total logs to ${filtered.length} logs containing "${versionMarker}"`
    );
    return filtered;
  }

  return allLogs.map((log) => log.message);
}

/**
 * Counts unique visitors by IP address from log messages.
 */
function countUniqueVisitors(logs: string[]): number {
  const uniqueIps = new Set<string>();

  for (const log of logs) {
    // Only process lines that contain IP information (VISIT or API entries)
    if (!log.includes("IP:")) {
      continue;
    }

    const ip = extractIpFromLine(log);
    if (ip) {
      uniqueIps.add(ip);
    }
  }

  return uniqueIps.size;
}

/**
 * Main execution function.
 */
async function main() {
  const token = process.env.RAILWAY_TOKEN;

  if (!token) {
    console.error("Error: RAILWAY_TOKEN is not set in environment variables");
    console.error("Please add RAILWAY_TOKEN to your .env file");
    process.exit(1);
  }

  try {
    console.log(`Fetching project ID for "${PROJECT_NAME}"...`);
    const projectId = await fetchProjectId(token);

    // Filter logs by version marker [v2] to only count logs from the new version
    // that correctly logs real client IPs (not proxy IPs)
    const versionMarker = "[v2]";

    console.log(`Fetching logs from Railway...`);
    console.log(`Filtering logs to only include entries with version marker "${versionMarker}"`);
    const logs = await fetchLogs(token, projectId, versionMarker);

    console.log(`Processing ${logs.length} log entries...`);
    const uniqueVisitorCount = countUniqueVisitors(logs);

    console.log(`\nTotal unique visitors (by IP): ${uniqueVisitorCount}`);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

void main();
