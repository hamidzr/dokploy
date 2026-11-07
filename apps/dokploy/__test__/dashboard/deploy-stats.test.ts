import { describe, expect, test } from "vitest";
import {
	type DeployStatsDeployment,
	getDeployStats,
} from "@/components/dashboard/home/deploy-stats";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse("2026-11-07T12:00:00Z");

const deploysFor = (
	service: Partial<DeployStatsDeployment>,
	daysAgo: number[],
): DeployStatsDeployment[] =>
	daysAgo.map((d) => ({
		...service,
		createdAt: new Date(now - d * DAY).toISOString(),
	}));

const range = (from: number, count: number, step = 0.5) =>
	Array.from({ length: count }, (_, i) => from + i * step);

describe("getDeployStats", () => {
	test("no deployments", () => {
		expect(getDeployStats([], now)).toEqual({
			value: "0",
			delta: "no activity yet",
		});
	});

	test("compares the last 7 days with the 7 days before", () => {
		const deployments = [
			...deploysFor({ applicationId: "a" }, [1, 2, 3]),
			...deploysFor({ composeId: "c" }, [8, 9]),
		];
		expect(getDeployStats(deployments, now)).toEqual({
			value: "3",
			delta: "+50% vs prev 7d",
		});
	});

	test("reports no prior data when the previous week is empty", () => {
		expect(
			getDeployStats(deploysFor({ applicationId: "a" }, [1, 2]), now),
		).toEqual({ value: "2", delta: "no prior data" });
	});

	test("marks the count as a lower bound when pruning reached the last 7 days", () => {
		const deployments = [
			...deploysFor({ applicationId: "busy" }, range(0.5, 11)),
			...deploysFor({ applicationId: "quiet" }, [10]),
		];
		expect(getDeployStats(deployments, now)).toEqual({
			value: "11+",
			delta: "older deploys pruned",
		});
	});

	test("skips the comparison when pruning reached the previous 7 days", () => {
		const deployments = [
			...deploysFor({ composeId: "busy" }, range(2.5, 11, 1)),
			...deploysFor({ applicationId: "quiet" }, [1]),
		];
		expect(getDeployStats(deployments, now)).toEqual({
			value: "6",
			delta: "prev 7d incomplete (pruned)",
		});
	});

	test("compares normally when pruning only removed older deployments", () => {
		const deployments = deploysFor(
			{ applicationId: "a" },
			[1, 2, 8, 9, 10, 11, 12, 13, 15, 16, 20],
		);
		expect(getDeployStats(deployments, now)).toEqual({
			value: "2",
			delta: "-67% vs prev 7d",
		});
	});

	test("does not treat a service at the retention limit as pruned", () => {
		const deployments = deploysFor({ applicationId: "a" }, range(0.5, 10));
		expect(getDeployStats(deployments, now)).toEqual({
			value: "10",
			delta: "no prior data",
		});
	});

	test("counts applications and compose services separately", () => {
		const deployments = [
			...deploysFor({ applicationId: "app" }, range(0.5, 6)),
			...deploysFor({ composeId: "other" }, range(0.5, 6)),
		];
		expect(getDeployStats(deployments, now)).toEqual({
			value: "12",
			delta: "no prior data",
		});
	});
});
