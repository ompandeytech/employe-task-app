import PullToRefresh from "react-pull-to-refresh";

const SafePullToRefresh = ({
  pullingContent,
  refreshingContent,
  onRefresh,
  children,
  ...rest
}) => (
  <PullToRefresh
    {...rest}
    onRefresh={onRefresh}
    icon={pullingContent}
    loading={refreshingContent}
  >
    {children}
  </PullToRefresh>
);

const RefreshWrapper = ({ onRefresh, children, className = "" }) => {
  const handleRefresh = () => {
    if (typeof onRefresh === "function") {
      return Promise.resolve(onRefresh());
    }
    return Promise.resolve();
  };

  const pullingContent = <div style={{ height: 0 }} />;
  const refreshingContent = <div style={{ height: 0 }} />;

  return (
    <SafePullToRefresh
      onRefresh={handleRefresh}
      className={`refresh-wrapper ${className}`.trim()}
      pullingContent={pullingContent}
      refreshingContent={refreshingContent}
      resistance={0.6}
    >
      <div style={{ minHeight: "100vh" }}>{children}</div>
    </SafePullToRefresh>
  );
};

export default RefreshWrapper;
