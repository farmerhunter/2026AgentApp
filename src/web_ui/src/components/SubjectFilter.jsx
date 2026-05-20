export const subjectOptions = [
  { value: "all", label: "全部" },
  { value: "chinese", label: "语文" },
  { value: "math", label: "数学" },
  { value: "english", label: "英语" },
];

export function getSubjectLabel(subject) {
  return subjectOptions.find((item) => item.value === subject)?.label ?? subject;
}

export function matchesSubject(item, selectedSubject) {
  return selectedSubject === "all" || item?.subject === selectedSubject;
}

export default function SubjectFilter({
  value,
  onChange,
  subjects = [],
  className = "",
}) {
  const subjectStatus = new Map(
    subjects.map((item) => [item.subject, item.status ?? "active"]),
  );

  return (
    <div className={["flex flex-wrap gap-2", className].filter(Boolean).join(" ")}>
      {subjectOptions.map((option) => {
        const status =
          option.value === "all" ? "active" : subjectStatus.get(option.value);
        const isNoData = status === "no_data" || status === undefined;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={[
              "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
              value === option.value
                ? "border-aurora bg-aurora text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-aurora/40 hover:text-aurora",
              isNoData && value !== option.value ? "opacity-60" : "",
            ].join(" ")}
            aria-pressed={value === option.value}
          >
            {option.label}
            {isNoData && option.value !== "all" ? " · 空" : ""}
          </button>
        );
      })}
    </div>
  );
}
