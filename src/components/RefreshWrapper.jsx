import { useCallback, useRef, useState } from "react";

const MAX_PULL = 80;
const PULL_THRESHOLD = 60;

const RefreshWrapper = ({ onRefresh, children, className = "" }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  const triggerRefresh = useCallback(async () => {
    if (typeof onRefresh !== "function") return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const handleRelease = useCallback(async () => {
    if (pullDistance >= PULL_THRESHOLD) {
      await triggerRefresh();
    }
    setPullDistance(0);
    pulling.current = false;
  }, [pullDistance, triggerRefresh]);

  const handleTouchStart = (event) => {
    const scrollElement = document.scrollingElement || document.documentElement;
    if (scrollElement?.scrollTop <= 0 && !refreshing) {
      startY.current = event.touches[0].clientY;
      pulling.current = true;
    }
  };

  const applyPullDistance = (distance) => {
    let pull = Math.max(0, distance);
    pull = Math.min(pull, MAX_PULL);
    setPullDistance(pull);
  };

  const handleTouchMove = (event) => {
    if (!pulling.current) return;
    const currentY = event.touches[0].clientY;
    applyPullDistance(currentY - startY.current);
    if (pullDistance > 0) {
      event.preventDefault();
    }
  };

  const handleMouseStart = (event) => {
    const scrollElement = document.scrollingElement || document.documentElement;
    if (scrollElement?.scrollTop <= 0 && !refreshing) {
      startY.current = event.clientY;
      pulling.current = true;
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseEnd);
    }
  };

  const handleMouseMove = (event) => {
    if (!pulling.current) return;
    applyPullDistance(event.clientY - startY.current);
  };

  const handleMouseEnd = () => {
    finishInteraction();
  };

  const finishInteraction = () => {
    handleRelease();
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseEnd);
  };

  const handleTouchEnd = () => {
    if (!pulling.current) return;
    handleRelease();
  };

  const handleTouchCancel = () => {
    if (!pulling.current) return;
    handleRelease();
  };

  const wrapperStyle = {
    transform: `translateY(${pullDistance}px)`,
    transition: pullDistance === 0 ? "transform 250ms ease" : "none",
  };

  return (
    <div
      className={`refresh-wrapper ${className}`.trim()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseStart}
    >
      <div className="pull-wrapper" style={wrapperStyle}>
        {children}
      </div>
    </div>
  );
};

export default RefreshWrapper;
