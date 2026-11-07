// createDeployment prunes each service to its newest 10 deployments before
// inserting a new one, so a service with more rows may have lost older ones
const RETAINED_PER_SERVICE = 10;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface DeployStatsDeployment {
	createdAt: string;
	applicationId?: string | null;
	composeId?: string | null;
}

export interface DeployStats {
	value: string;
	delta: string;
}

export function getDeployStats(
	deployments: DeployStatsDeployment[],
	now: number,
): DeployStats {
	const lastStart = now - WEEK_MS;
	const prevStart = now - 2 * WEEK_MS;

	let lastCount = 0;
	let prevCount = 0;
	const services = new Map<string, { count: number; oldest: number }>();
	for (const d of deployments) {
		const t = new Date(d.createdAt).getTime();
		if (t >= lastStart) lastCount++;
		else if (t >= prevStart) prevCount++;

		const key = d.applicationId ?? d.composeId;
		if (!key) continue;
		const service = services.get(key);
		if (service) {
			service.count++;
			service.oldest = Math.min(service.oldest, t);
		} else {
			services.set(key, { count: 1, oldest: t });
		}
	}

	// counts before this point can be missing pruned deployments
	let completeSince = Number.NEGATIVE_INFINITY;
	for (const service of services.values()) {
		if (service.count > RETAINED_PER_SERVICE) {
			completeSince = Math.max(completeSince, service.oldest);
		}
	}

	if (completeSince > lastStart) {
		return { value: `${lastCount}+`, delta: "older deploys pruned" };
	}
	if (completeSince > prevStart) {
		return {
			value: String(lastCount),
			delta: "prev 7d incomplete (pruned)",
		};
	}

	let delta: string;
	if (prevCount > 0) {
		const pct = Math.round(((lastCount - prevCount) / prevCount) * 100);
		delta = `${pct >= 0 ? "+" : ""}${pct}% vs prev 7d`;
	} else if (lastCount > 0) {
		delta = "no prior data";
	} else {
		delta = "no activity yet";
	}

	return { value: String(lastCount), delta };
}
