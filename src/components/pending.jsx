import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Pending() {
  const [range, setRange] = useState("7");
  const navigate = useNavigate();

const doneTasks = JSON.parse(localStorage.getItem("doneTasks") || "[]");

const getDaysDiff = (taskDate) =>
  Math.floor((new Date() - new Date(taskDate)) / (1000 * 60 * 60 * 24));

const filtered = doneTasks.filter(t => {
  const d = getDaysDiff(t.date);

  if (range === "1") return d <= 1;
  if (range === "7") return d <= 7;
  if (range === "30") return d <= 30;
  return true;
});


  return (
    <div className="mobile-container">
      <div className="page-header">
  <button className="back-circle" onClick={() => navigate("/dashboard")}>
  ←
</button>

  <h3>Pending Task</h3>   {/* page ke hisaab se naam change karna */}
</div>


     <div className="report-filters">
  <button className={range==="1"?"active":""} onClick={()=>setRange("1")}>
    Yesterday
  </button>
  <button className={range==="7"?"active":""} onClick={()=>setRange("7")}>
    Last 7 Days
  </button>
  <button className={range==="30"?"active":""} onClick={()=>setRange("30")}>
    Last Month
  </button>
</div>


      {filtered.length === 0 ? (
        <p>No pending tasks.</p>
      ) : (
        filtered.map((t,i)=>(
          <div key={i} className="task-card task-pending">
            <b>{t.name}</b>
            <p>Reason: {t.reason}</p>
            <p>Date: {t.date}</p>
          </div>
        ))
      )}
    </div>
  );
}
