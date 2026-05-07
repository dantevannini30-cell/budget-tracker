import GoalProgressChart from "./GoalProgressChart";

import useSpendingTargets from "./hooks/useSpendingTargets";

import { buildSpendingTargetChartData } from "./utils/chartUtils";

import {
  cardStyle,
  inputStyle,
  primaryBtn,
} from "@/shared/styles/ui";

export default function SpendingTargetsSection({
  budgetId,
}) {
  const {
    targets,
    progress,
    form,
    setForm,
    handleSubmit,
  } = useSpendingTargets(budgetId);

  const chartData =
    buildSpendingTargetChartData(
      targets,
      progress
    );

  return (
    <div
      style={{
        ...cardStyle,
        padding: 22,
      }}
    >
      {/* KEEP YOUR EXISTING JSX HERE */}

      {/* Paste the JSX body from your original component */}
    </div>
  );
}