import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { supabase } from "./supabaseClient";

const categories = ["All", "Personal", "School", "Work", "Fun", "Urgent"];
const priorities = ["Low", "Medium", "High"];

const fallbackSubcategories = {
  School: ["Assignment", "Exam", "Quiz"],
  Work: ["Meeting", "Email", "Project"],
};

function parseEstimatedMinutes(timeText) {
  if (!timeText) return 0;

  const text = timeText.toLowerCase();

  const hourMatch = text.match(/(\d+)\s*(h|hr|hrs|hour|hours)/);
  const minuteMatch = text.match(/(\d+)\s*(m|min|mins|minute|minutes)/);

  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;

  if (!hourMatch && !minuteMatch) {
    const numberOnly = text.match(/\d+/);
    return numberOnly ? Number(numberOnly[0]) : 0;
  }

  return hours * 60 + minutes;
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function getPokerProfit(session) {
  return Number(session.cash_out || 0) - Number(session.buy_in || 0);
}

function getMonthKey(dateText) {
  if (!dateText) return "";
  return dateText.slice(0, 7);
}

function getMonthLabel(monthKey) {
  if (!monthKey || monthKey === "All") return "All time";

  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function AppMenu({ activePage, setActivePage, theme, setTheme }) {
  const [menuOpen, setMenuOpen] = useState(false);

  function switchPage(page) {
    setActivePage(page);
    setMenuOpen(false);
  }

  return (
    <div className="floating-menu">
      <button
        type="button"
        className="hamburger-button"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Open menu"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {menuOpen && (
        <div className="menu-dropdown">
          <button
            type="button"
            className={activePage === "checklist" ? "active" : ""}
            onClick={() => switchPage("checklist")}
          >
            Checklist
          </button>

          <button
            type="button"
            className={activePage === "poker" ? "active" : ""}
            onClick={() => switchPage("poker")}
          >
            Poker Earnings
          </button>

          <div className="menu-divider"></div>

          <button
            type="button"
            onClick={() => {
              setTheme(theme === "light" ? "dark" : "light");
              setMenuOpen(false);
            }}
          >
            {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
          </button>
        </div>
      )}
    </div>
  );
}

function PokerGraph({ sessions }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const points = useMemo(() => {
    let runningTotal = 0;

    return [...sessions]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((session, index) => {
        const profit = getPokerProfit(session);
        runningTotal += profit;

        return {
          id: session.id,
          index,
          date: session.date,
          profit,
          bankroll: runningTotal,
          gameType: session.game_type,
        };
      });
  }, [sessions]);

  if (points.length === 0) {
    return (
      <div className="poker-chart-empty">
        <h2>No graph yet</h2>
        <p>Add a session to see your bankroll movement.</p>
      </div>
    );
  }

  const width = 900;
  const height = 280;
  const padX = 44;
  const padY = 38;

  const maxValue = Math.max(...points.map((point) => point.bankroll), 0);
  const minValue = Math.min(...points.map((point) => point.bankroll), 0);
  const range = Math.max(maxValue - minValue, 1);

  function getX(index) {
    if (points.length === 1) return width / 2;
    return padX + (index / (points.length - 1)) * (width - padX * 2);
  }

  function getY(value) {
    return height - padY - ((value - minValue) / range) * (height - padY * 2);
  }

  function formatShortDate(dateText) {
    const date = new Date(dateText + "T00:00:00");

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const zeroY = getY(0);
  const activePoint = hoveredPoint || points[points.length - 1];

  const activeX = getX(activePoint.index);
  const activeY = getY(activePoint.bankroll);

  const tooltipWidth = 210;
  const tooltipHeight = 86;

  const tooltipX = Math.min(
    Math.max(activeX - tooltipWidth / 2, 12),
    width - tooltipWidth - 12
  );

  const tooltipY =
    activeY - tooltipHeight - 18 < 10
      ? activeY + 18
      : activeY - tooltipHeight - 18;

  return (
    <div className="poker-chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="poker-chart"
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <line
          x1={padX}
          x2={width - padX}
          y1={zeroY}
          y2={zeroY}
          className="poker-chart-zero"
        />

        {points.length === 1 ? (
          <circle
            cx={getX(0)}
            cy={getY(points[0].bankroll)}
            r="7"
            className={points[0].bankroll >= 0 ? "chart-dot-good" : "chart-dot-bad"}
          />
        ) : (
          points.slice(1).map((point, index) => {
            const previous = points[index];
            const isPositive = point.bankroll >= 0;

            return (
              <line
                key={`${point.id}-line`}
                x1={getX(previous.index)}
                y1={getY(previous.bankroll)}
                x2={getX(point.index)}
                y2={getY(point.bankroll)}
                className={isPositive ? "chart-line-good" : "chart-line-bad"}
              />
            );
          })
        )}

        {points.map((point, index) => {
          const previousX = index === 0 ? padX : getX(index - 1);
          const nextX = index === points.length - 1 ? width - padX : getX(index + 1);
          const currentX = getX(index);

          const zoneStart = index === 0 ? padX : (previousX + currentX) / 2;
          const zoneEnd = index === points.length - 1 ? width - padX : (currentX + nextX) / 2;

          return (
            <rect
              key={`${point.id}-hover-zone`}
              x={zoneStart}
              y="0"
              width={Math.max(zoneEnd - zoneStart, 20)}
              height={height}
              className="chart-hover-zone"
              onMouseEnter={() => setHoveredPoint(point)}
              onMouseMove={() => setHoveredPoint(point)}
            />
          );
        })}

        <line
          x1={activeX}
          x2={activeX}
          y1={padY}
          y2={height - padY}
          className="chart-hover-line"
        />

        {points.map((point) => {
          const isActive = activePoint.id === point.id;

          return (
            <circle
              key={`${point.id}-dot`}
              cx={getX(point.index)}
              cy={getY(point.bankroll)}
              r={isActive ? "8" : "5"}
              className={point.bankroll >= 0 ? "chart-dot-good" : "chart-dot-bad"}
              onMouseEnter={() => setHoveredPoint(point)}
            />
          );
        })}

        <g className="chart-tooltip">
          <rect
            x={tooltipX}
            y={tooltipY}
            width={tooltipWidth}
            height={tooltipHeight}
            rx="16"
            className="chart-tooltip-box"
          />

          <text x={tooltipX + 16} y={tooltipY + 25} className="chart-tooltip-title">
            {formatShortDate(activePoint.date)}
          </text>

          <text x={tooltipX + 16} y={tooltipY + 48} className="chart-tooltip-text">
            Session: {formatCurrency(activePoint.profit)}
          </text>

          <text
            x={tooltipX + 16}
            y={tooltipY + 70}
            className={
              activePoint.bankroll >= 0
                ? "chart-tooltip-good"
                : "chart-tooltip-bad"
            }
          >
            Total: {formatCurrency(activePoint.bankroll)}
          </text>
        </g>
      </svg>

      <div className="poker-chart-footer">
        <span>
          Sessions shown: <strong>{points.length}</strong>
        </span>

        <span>
          Current total:{" "}
          <strong className={points[points.length - 1].bankroll >= 0 ? "profit-good" : "profit-bad"}>
            {formatCurrency(points[points.length - 1].bankroll)}
          </strong>
        </span>
      </div>
    </div>
  );
}

function PokerTracker() {
  const [pokerSessions, setPokerSessions] = useState([]);
  const [pokerLoading, setPokerLoading] = useState(true);

  const [pokerForm, setPokerForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    game_type: "Online",
    buy_in: "",
    cash_out: "",
    hours: "",
  });

  const [pokerFilter, setPokerFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const [pokerSortBy, setPokerSortBy] = useState("Newest first");

  useEffect(() => {
    fetchPokerSessions();
  }, []);

  async function fetchPokerSessions() {
    setPokerLoading(true);

    const { data, error } = await supabase
      .from("poker_sessions")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("Error loading poker sessions:", error.message);
      console.error(error);
      setPokerSessions([]);
    } else {
      setPokerSessions(data || []);
    }

    setPokerLoading(false);
  }

  function handlePokerChange(event) {
    const { name, value } = event.target;

    setPokerForm({
      ...pokerForm,
      [name]: value,
    });
  }

  async function addPokerSession(event) {
    event.preventDefault();

    if (!pokerForm.date || !pokerForm.buy_in || !pokerForm.cash_out || !pokerForm.hours) {
      alert("Please fill out date, buy-in, cash-out, and hours.");
      return;
    }

    const newPokerSession = {
      date: pokerForm.date,
      game_type: pokerForm.game_type,
      buy_in: Number(pokerForm.buy_in),
      cash_out: Number(pokerForm.cash_out),
      hours: Number(pokerForm.hours),
    };

    const { data, error } = await supabase
      .from("poker_sessions")
      .insert([newPokerSession])
      .select()
      .single();

    if (error) {
      console.error("Error adding poker session:", error.message);
      console.error(error);
      alert(`Could not add poker session: ${error.message}`);
      return;
    }

    setPokerSessions([data, ...pokerSessions]);

    setPokerForm({
      date: new Date().toISOString().slice(0, 10),
      game_type: "Online",
      buy_in: "",
      cash_out: "",
      hours: "",
    });
  }

  async function deletePokerSession(id) {
    const { error } = await supabase.from("poker_sessions").delete().eq("id", id);

    if (error) {
      console.error("Error deleting poker session:", error.message);
      console.error(error);
      alert(`Could not delete poker session: ${error.message}`);
      return;
    }

    setPokerSessions(pokerSessions.filter((session) => session.id !== id));
  }

  async function resetPokerTracker() {
    const sessionIds = pokerSessions.map((session) => session.id);

    if (sessionIds.length === 0) return;

    const confirmed = window.confirm("Are you sure you want to delete all poker sessions?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("poker_sessions")
      .delete()
      .in("id", sessionIds);

    if (error) {
      console.error("Error resetting poker tracker:", error.message);
      console.error(error);
      alert(`Could not reset poker tracker: ${error.message}`);
      return;
    }

    setPokerSessions([]);
  }

  const monthOptions = useMemo(() => {
    const months = pokerSessions
      .map((session) => getMonthKey(session.date))
      .filter(Boolean);

    return [...new Set(months)].sort((a, b) => b.localeCompare(a));
  }, [pokerSessions]);

  const filteredSessions = useMemo(() => {
    let result = [...pokerSessions];

    if (monthFilter !== "All") {
      result = result.filter((session) => getMonthKey(session.date) === monthFilter);
    }

    if (pokerFilter !== "All") {
      result = result.filter((session) => session.game_type === pokerFilter);
    }

    return result;
  }, [pokerSessions, monthFilter, pokerFilter]);

  const pokerStats = useMemo(() => {
    const totalProfit = filteredSessions.reduce(
      (sum, session) => sum + getPokerProfit(session),
      0
    );

    const totalHours = filteredSessions.reduce(
      (sum, session) => sum + Number(session.hours || 0),
      0
    );

    const hourlyRate = totalHours > 0 ? totalProfit / totalHours : 0;

    const winningSessions = filteredSessions.filter(
      (session) => getPokerProfit(session) > 0
    ).length;

    const winRate =
      filteredSessions.length > 0
        ? Math.round((winningSessions / filteredSessions.length) * 100)
        : 0;

    const bestSession =
      filteredSessions.length > 0
        ? Math.max(...filteredSessions.map((session) => getPokerProfit(session)))
        : 0;

    const worstSession =
      filteredSessions.length > 0
        ? Math.min(...filteredSessions.map((session) => getPokerProfit(session)))
        : 0;

    return {
      totalProfit,
      totalHours,
      hourlyRate,
      winRate,
      bestSession,
      worstSession,
      totalSessions: filteredSessions.length,
    };
  }, [filteredSessions]);

  const sortedPokerSessions = useMemo(() => {
    const result = [...filteredSessions];

    if (pokerSortBy === "Newest first") {
      result.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    if (pokerSortBy === "Oldest first") {
      result.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    if (pokerSortBy === "Highest profit") {
      result.sort((a, b) => getPokerProfit(b) - getPokerProfit(a));
    }

    if (pokerSortBy === "Lowest profit") {
      result.sort((a, b) => getPokerProfit(a) - getPokerProfit(b));
    }

    return result;
  }, [filteredSessions, pokerSortBy]);

  const projectedProfit =
    Number(pokerForm.cash_out || 0) - Number(pokerForm.buy_in || 0);

  return (
    <div className="poker-page">
      <div className="poker-hero">
        <div>
          <p className="poker-eyebrow">♠ bankroll command center</p>
          <h1>Poker Earnings</h1>
          <p>
            Track buy-ins, cash-outs, session type, monthly performance, and bankroll movement.
          </p>
        </div>

        <button className="poker-danger-button" onClick={resetPokerTracker}>
          Reset Tracker
        </button>
      </div>

      <div className="poker-period-banner">
        <span>Viewing</span>
        <strong>{monthFilter === "All" ? "All time" : getMonthLabel(monthFilter)}</strong>
        {pokerFilter !== "All" && <em>{pokerFilter}</em>}
      </div>

      <div className="poker-stats-grid">
        <div className="poker-stat-card main-stat">
          <span>Total Profit</span>
          <strong className={pokerStats.totalProfit >= 0 ? "profit-good" : "profit-bad"}>
            {formatCurrency(pokerStats.totalProfit)}
          </strong>
        </div>

        <div className="poker-stat-card">
          <span>Hourly Rate</span>
          <strong className={pokerStats.hourlyRate >= 0 ? "profit-good" : "profit-bad"}>
            {formatCurrency(pokerStats.hourlyRate)}/hr
          </strong>
        </div>

        <div className="poker-stat-card">
          <span>Sessions</span>
          <strong>{pokerStats.totalSessions}</strong>
        </div>

        <div className="poker-stat-card">
          <span>Win Rate</span>
          <strong>{pokerStats.winRate}%</strong>
        </div>

        <div className="poker-stat-card">
          <span>Total Hours</span>
          <strong>{Number(pokerStats.totalHours || 0).toFixed(1)}</strong>
        </div>

        <div className="poker-stat-card">
          <span>Best Session</span>
          <strong className="profit-good">{formatCurrency(pokerStats.bestSession)}</strong>
        </div>

        <div className="poker-stat-card">
          <span>Worst Session</span>
          <strong className="profit-bad">{formatCurrency(pokerStats.worstSession)}</strong>
        </div>
      </div>

      <div className="poker-chart-card">
        <div className="poker-chart-header">
          <div>
            <p className="poker-eyebrow">♥ bankroll graph</p>
            <h2>Performance Over Sessions</h2>
          </div>
          <p>Hover over the graph to see your running total at each session.</p>
        </div>

        <PokerGraph sessions={filteredSessions} />
      </div>

      <div className="poker-main-grid">
        <form className="poker-form-card" onSubmit={addPokerSession}>
          <div>
            <p className="poker-eyebrow">♦ new session</p>
            <h2>Add Poker Session</h2>
          </div>

          <label>
            Date
            <input
              type="date"
              name="date"
              value={pokerForm.date}
              onChange={handlePokerChange}
            />
          </label>

          <label>
            Session Type
            <select
              name="game_type"
              value={pokerForm.game_type}
              onChange={handlePokerChange}
            >
              <option>Online</option>
              <option>In Person</option>
              <option>Casino</option>
            </select>
          </label>

          <label>
            Buy-In
            <input
              type="number"
              name="buy_in"
              placeholder="ex: 100"
              value={pokerForm.buy_in}
              onChange={handlePokerChange}
            />
          </label>

          <label>
            Cash-Out
            <input
              type="number"
              name="cash_out"
              placeholder="ex: 250"
              value={pokerForm.cash_out}
              onChange={handlePokerChange}
            />
          </label>

          <label>
            Hours Played
            <input
              type="number"
              step="0.1"
              name="hours"
              placeholder="ex: 3.5"
              value={pokerForm.hours}
              onChange={handlePokerChange}
            />
          </label>

          <div className="poker-projected-card">
            <span>Projected Profit/Loss</span>
            <strong className={projectedProfit >= 0 ? "profit-good" : "profit-bad"}>
              {formatCurrency(projectedProfit)}
            </strong>
          </div>

          <button type="submit" className="poker-add-button">
            Add Session
          </button>
        </form>

        <div className="poker-history-card">
          <div className="poker-history-header">
            <div>
              <p className="poker-eyebrow">♣ session log</p>
              <h2>History</h2>
            </div>

            <div className="poker-filters">
              <select
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
              >
                <option value="All">All months</option>
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {getMonthLabel(month)}
                  </option>
                ))}
              </select>

              <select
                value={pokerFilter}
                onChange={(event) => setPokerFilter(event.target.value)}
              >
                <option>All</option>
                <option>Online</option>
                <option>In Person</option>
                <option>Casino</option>
              </select>

              <select
                value={pokerSortBy}
                onChange={(event) => setPokerSortBy(event.target.value)}
              >
                <option>Newest first</option>
                <option>Oldest first</option>
                <option>Highest profit</option>
                <option>Lowest profit</option>
              </select>
            </div>
          </div>

          {pokerLoading ? (
            <div className="poker-empty">
              <h2>Loading sessions...</h2>
              <p>Pulling the latest data from Supabase.</p>
            </div>
          ) : sortedPokerSessions.length === 0 ? (
            <div className="poker-empty">
              <h2>No poker sessions found</h2>
              <p>Try another month or add a new session.</p>
            </div>
          ) : (
            <div className="poker-session-list">
              {sortedPokerSessions.map((session) => {
                const profit = getPokerProfit(session);

                return (
                  <article key={session.id} className="poker-session-card">
                    <div>
                      <div className="poker-session-top">
                        <h3>{session.game_type}</h3>
                        <strong className={profit >= 0 ? "profit-good" : "profit-bad"}>
                          {formatCurrency(profit)}
                        </strong>
                      </div>

                      <div className="poker-session-meta">
                        <span>{session.date}</span>
                        <span>Buy-in: {formatCurrency(session.buy_in)}</span>
                        <span>Cash-out: {formatCurrency(session.cash_out)}</span>
                        <span>{session.hours} hrs</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="poker-delete-button"
                      onClick={() => deletePokerSession(session.id)}
                    >
                      Delete
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState("checklist");

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [theme, setTheme] = useState("light");

  const [customSubcategories, setCustomSubcategories] =
    useState(fallbackSubcategories);

  const [newTask, setNewTask] = useState("");
  const [category, setCategory] = useState("Personal");
  const [subcategory, setSubcategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");

  const [filter, setFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Default");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const [celebrated, setCelebrated] = useState(false);

  const completedCount = tasks.filter((task) => task.completed).length;

  const progress = tasks.length
    ? Math.round((completedCount / tasks.length) * 100)
    : 0;

  const allDone = tasks.length > 0 && completedCount === tasks.length;

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  useEffect(() => {
    fetchTasks();
    fetchSubcategories();
  }, []);

  useEffect(() => {
    if (allDone && !celebrated && activePage === "checklist") {
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.7 },
      });
      setCelebrated(true);
    }

    if (!allDone) {
      setCelebrated(false);
    }
  }, [allDone, celebrated, activePage]);

  async function fetchTasks() {
    setLoading(true);

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading tasks:", error.message);
      console.error(error);
      setTasks([]);
    } else {
      setTasks(data || []);
    }

    setLoading(false);
  }

  async function fetchSubcategories() {
    const { data, error } = await supabase
      .from("subcategories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error loading subcategories:", error.message);
      console.error(error);
      return;
    }

    const grouped = {
      School: [...fallbackSubcategories.School],
      Work: [...fallbackSubcategories.Work],
    };

    (data || []).forEach((item) => {
      if (!grouped[item.category]) return;

      const exists = grouped[item.category].some(
        (name) => name.toLowerCase() === item.name.toLowerCase()
      );

      if (!exists) {
        grouped[item.category].push(item.name);
      }
    });

    setCustomSubcategories(grouped);
  }

  const filteredTasks = useMemo(() => {
    const priorityRank = {
      High: 3,
      Medium: 2,
      Low: 1,
    };

    const filtered = tasks.filter((task) => {
      const matchesCategory = filter === "All" || task.category === filter;

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Completed" && task.completed) ||
        (statusFilter === "Active" && !task.completed);

      const matchesSearch = (task.title || "")
        .toLowerCase()
        .includes(search.toLowerCase());

      return matchesCategory && matchesStatus && matchesSearch;
    });

    const sorted = [...filtered];

    if (sortBy === "Most urgent") {
      sorted.sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]);
    }

    if (sortBy === "Least urgent") {
      sorted.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);
    }

    if (sortBy === "Most time") {
      sorted.sort(
        (a, b) =>
          parseEstimatedMinutes(b.estimatedTime) -
          parseEstimatedMinutes(a.estimatedTime)
      );
    }

    if (sortBy === "Least time") {
      sorted.sort(
        (a, b) =>
          parseEstimatedMinutes(a.estimatedTime) -
          parseEstimatedMinutes(b.estimatedTime)
      );
    }

    return sorted;
  }, [tasks, filter, statusFilter, search, sortBy]);

  async function addSubcategory() {
    const cleaned = newSubcategory.trim();

    if (!cleaned) return;
    if (category !== "School" && category !== "Work") return;

    const currentList = customSubcategories[category] || [];

    const alreadyExists = currentList.some(
      (sub) => sub.toLowerCase() === cleaned.toLowerCase()
    );

    if (alreadyExists) {
      setSubcategory(cleaned);
      setNewSubcategory("");
      return;
    }

    const { error } = await supabase.from("subcategories").insert([
      {
        category,
        name: cleaned,
      },
    ]);

    if (error) {
      console.error("Error adding subcategory:", error.message);
      console.error(error);
      alert(`Could not add subcategory: ${error.message}`);
      return;
    }

    setCustomSubcategories({
      ...customSubcategories,
      [category]: [...currentList, cleaned],
    });

    setSubcategory(cleaned);
    setNewSubcategory("");
  }

  async function addTask(event) {
    event.preventDefault();

    if (!newTask.trim()) return;

    const newTaskData = {
      title: newTask.trim(),
      category,
      subcategory,
      priority,
      dueDate,
      estimatedTime,
      completed: false,
    };

    const { data, error } = await supabase
      .from("tasks")
      .insert([newTaskData])
      .select()
      .single();

    if (error) {
      console.error("Error adding task:", error.message);
      console.error(error);
      alert(`Could not add task: ${error.message}`);
      return;
    }

    setTasks([data, ...tasks]);

    setNewTask("");
    setCategory("Personal");
    setSubcategory("");
    setNewSubcategory("");
    setPriority("Medium");
    setDueDate("");
    setEstimatedTime("");
  }

  async function toggleTask(id) {
    const task = tasks.find((task) => task.id === id);
    if (!task) return;

    const { data, error } = await supabase
      .from("tasks")
      .update({ completed: !task.completed })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating task:", error.message);
      console.error(error);
      alert(`Could not update task: ${error.message}`);
      return;
    }

    setTasks(tasks.map((task) => (task.id === id ? data : task)));
  }

  async function deleteTask(id) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      console.error("Error deleting task:", error.message);
      console.error(error);
      alert(`Could not delete task: ${error.message}`);
      return;
    }

    setTasks(tasks.filter((task) => task.id !== id));
  }

  function startEditing(task) {
    setEditingId(task.id);
    setEditingText(task.title);
  }

  async function saveEdit(id) {
    if (!editingText.trim()) return;

    const { data, error } = await supabase
      .from("tasks")
      .update({ title: editingText.trim() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error editing task:", error.message);
      console.error(error);
      alert(`Could not edit task: ${error.message}`);
      return;
    }

    setTasks(tasks.map((task) => (task.id === id ? data : task)));
    setEditingId(null);
    setEditingText("");
  }

  async function clearCompleted() {
    const completedIds = tasks
      .filter((task) => task.completed)
      .map((task) => task.id);

    if (completedIds.length === 0) return;

    const { error } = await supabase
      .from("tasks")
      .delete()
      .in("id", completedIds);

    if (error) {
      console.error("Error clearing completed tasks:", error.message);
      console.error(error);
      alert(`Could not clear completed tasks: ${error.message}`);
      return;
    }

    setTasks(tasks.filter((task) => !task.completed));
  }

  async function resetChecklist() {
    const taskIds = tasks.map((task) => task.id);

    if (taskIds.length === 0) return;

    const { error } = await supabase.from("tasks").delete().in("id", taskIds);

    if (error) {
      console.error("Error resetting checklist:", error.message);
      console.error(error);
      alert(`Could not reset checklist: ${error.message}`);
      return;
    }

    setTasks([]);
  }

  return (
    <main className={`app ${activePage === "poker" ? "poker-app" : ""}`}>
      <AppMenu
        activePage={activePage}
        setActivePage={setActivePage}
        theme={theme}
        setTheme={setTheme}
      />

      <section className={`checklist-shell ${activePage === "poker" ? "poker-shell" : ""}`}>
        <div className="blob blob-one"></div>
        <div className="blob blob-two"></div>

        {activePage === "poker" ? (
          <PokerTracker />
        ) : (
          <>
            <div className="top-bar">
              <div>
                <p className="eyebrow">aesthetic productivity board</p>
                <h1>Khyati’s Checklist</h1>
                <p className="subtitle">
                  Keep track of everything beautifully, one tiny win at a time.
                </p>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>Total</span>
                <strong>{tasks.length}</strong>
              </div>

              <div className="stat-card">
                <span>Done</span>
                <strong>{completedCount}</strong>
              </div>

              <div className="stat-card">
                <span>Left</span>
                <strong>{tasks.length - completedCount}</strong>
              </div>
            </div>

            <div className="progress-card">
              <div className="progress-info">
                <span>
                  {completedCount} of {tasks.length} done
                </span>
                <strong>{progress}%</strong>
              </div>

              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>

              {allDone && (
                <div className="celebration">
                  ✨ Everything is done. Khyati is unstoppable. ✨
                </div>
              )}
            </div>

            <form className="task-form" onSubmit={addTask}>
              <input
                type="text"
                placeholder="Add something to the checklist..."
                value={newTask}
                onChange={(event) => setNewTask(event.target.value)}
              />

              <select
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setSubcategory("");
                  setNewSubcategory("");
                }}
              >
                {categories
                  .filter((cat) => cat !== "All")
                  .map((cat) => (
                    <option key={cat}>{cat}</option>
                  ))}
              </select>

              {(category === "School" || category === "Work") && (
                <div className="subcategory-box">
                  <select
                    value={subcategory}
                    onChange={(event) => setSubcategory(event.target.value)}
                  >
                    <option value="">No subcategory</option>
                    {(customSubcategories[category] || []).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>

                  <div className="new-subcategory-row">
                    <input
                      type="text"
                      placeholder={`New ${category.toLowerCase()} subcategory...`}
                      value={newSubcategory}
                      onChange={(event) => setNewSubcategory(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addSubcategory();
                        }
                      }}
                    />

                    <button type="button" onClick={addSubcategory}>
                      +
                    </button>
                  </div>
                </div>
              )}

              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                {priorities.map((level) => (
                  <option key={level}>{level}</option>
                ))}
              </select>

              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />

              <div className="time-input-wrapper">
                <span className="clock-icon">⏰</span>
                <input
                  type="text"
                  placeholder="Time"
                  value={estimatedTime}
                  onChange={(event) => setEstimatedTime(event.target.value)}
                />
              </div>

              <button type="submit">Add</button>
            </form>

            <div className="dashboard-layout">
              <aside className="side-panel">
                <p className="panel-label">organize</p>
                <h2>Filters & Sorting</h2>

                <label>
                  Search
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>

                <label>
                  Category
                  <select
                    value={filter}
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    {categories.map((cat) => (
                      <option key={cat}>{cat}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option>All</option>
                    <option>Active</option>
                    <option>Completed</option>
                  </select>
                </label>

                <label>
                  Sort by
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                  >
                    <option>Default</option>
                    <option>Most urgent</option>
                    <option>Least urgent</option>
                    <option>Most time</option>
                    <option>Least time</option>
                  </select>
                </label>
              </aside>

              <div className="task-list">
                {loading ? (
                  <div className="empty-state">
                    <h2>Loading checklist...</h2>
                    <p>Grabbing the latest version from the cloud.</p>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="empty-state">
                    <h2>No tasks found</h2>
                    <p>Add a new item or change your filters.</p>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <article
                      key={task.id}
                      className={`task-card ${task.completed ? "completed" : ""}`}
                    >
                      <button
                        className="check-button"
                        onClick={() => toggleTask(task.id)}
                      >
                        {task.completed ? "✓" : ""}
                      </button>

                      <div className="task-content">
                        {editingId === task.id ? (
                          <div className="edit-row">
                            <input
                              value={editingText}
                              onChange={(event) =>
                                setEditingText(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") saveEdit(task.id);
                              }}
                              autoFocus
                            />
                            <button type="button" onClick={() => saveEdit(task.id)}>
                              Save
                            </button>
                          </div>
                        ) : (
                          <>
                            <h3>{task.title}</h3>

                            <div className="task-meta">
                              <span>{task.category}</span>

                              {task.subcategory && <span>{task.subcategory}</span>}

                              <span
                                className={`priority ${task.priority.toLowerCase()}`}
                              >
                                {task.priority}
                              </span>

                              {task.dueDate && <span>Due {task.dueDate}</span>}

                              {task.estimatedTime && (
                                <span className="time-badge">
                                  ⏰ {task.estimatedTime}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="task-actions">
                        <button type="button" onClick={() => startEditing(task)}>
                          Edit
                        </button>
                        <button type="button" onClick={() => deleteTask(task.id)}>
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="bottom-actions">
              <button type="button" onClick={clearCompleted}>
                Clear completed
              </button>
              <button type="button" onClick={resetChecklist}>
                Reset all
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}