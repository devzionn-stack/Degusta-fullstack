import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showValue?: boolean;
  color?: "default" | "success" | "warning" | "danger";
  label?: string;
}

export function CircularProgress({
  value,
  size = 80,
  strokeWidth = 8,
  className,
  showValue = true,
  color = "default",
  label,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  const colorClasses = {
    default: "stroke-primary",
    success: "stroke-green-500",
    warning: "stroke-amber-500",
    danger: "stroke-red-500",
  };

  const bgColorClasses = {
    default: "stroke-muted",
    success: "stroke-green-100 dark:stroke-green-900/30",
    warning: "stroke-amber-100 dark:stroke-amber-900/30",
    danger: "stroke-red-100 dark:stroke-red-900/30",
  };

  const textColorClasses = {
    default: "text-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={bgColorClasses[color]}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(colorClasses[color], "transition-all duration-300 ease-out")}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-lg font-bold", textColorClasses[color])}>
            {Math.round(value)}%
          </span>
          {label && (
            <span className="text-xs text-muted-foreground">{label}</span>
          )}
        </div>
      )}
    </div>
  );
}
