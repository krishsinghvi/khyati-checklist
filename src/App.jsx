import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";

const starterTasks = [
  {
    id: crypto.randomUUID(),
    title: "Finish the first checklist item",
    category: "Personal",
    subcategory: "",
    priority: "Medium",
    dueDate: "",
    estimatedTime: "30 min",
    completed: false,
  },
  {
    id: crypto.randomUUID(),
    title: "Plan something fun",
    category: "Fun",
    subcategory: "",
    priority: "Low",
    dueDate: "",
    estimatedTime: "1 hr",
    completed: false,
  },
];

const categories = ["All", "Personal", "School", "Work", "Fun", "Urgent"];
const priorities = ["Low", "Medium", "High"];

const defaultSubcategories = {
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

export default function App() {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem("khyati-checklist");
    return saved ? JSON.parse(saved) : starterTasks;
  });

  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("khyati-theme") || "light";
  });

  const [customSubcategories, setCustomSubcategories] = useState(() => {
    const saved = localStorage.getItem("khyati-subcategories");
    return saved ? JSON.parse(saved) : defaultSubcategories;
  });

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
    localStorage.setItem("khyati-checklist", JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem("khyati-theme", theme);
    document.body.className = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(
      "khyati-subcategories",
      JSON.stringify(customSubcategories)
    );
  }, [customSubcategories]);

  useEffect(() => {
    if (allDone && !celebrated) {
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
  }, [allDone, celebrated]);

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

      const matchesSearch = task.title
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

  function addSubcategory() {
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

    setCustomSubcategories({
      ...customSubcategories,
      [category]: [...currentList, cleaned],
    });

    setSubcategory(cleaned);
    setNewSubcategory("");
  }

  function addTask(event) {
    event.preventDefault();

    if (!newTask.trim()) return;

    const task = {
      id: crypto.randomUUID(),
      title: newTask.trim(),
      category,
      subcategory,
      priority,
      dueDate,
      estimatedTime,
      completed: false,
    };

    setTasks([task, ...tasks]);

    setNewTask("");
    setCategory("Personal");
    setSubcategory("");
    setNewSubcategory("");
    setPriority("Medium");
    setDueDate("");
    setEstimatedTime("");
  }

  function toggleTask(id) {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  function deleteTask(id) {
    setTasks(tasks.filter((task) => task.id !== id));
  }

  function startEditing(task) {
    setEditingId(task.id);
    setEditingText(task.title);
  }

  function saveEdit(id) {
    if (!editingText.trim()) return;

    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, title: editingText.trim() } : task
      )
    );

    setEditingId(null);
    setEditingText("");
  }

  function clearCompleted() {
    setTasks(tasks.filter((task) => !task.completed));
  }

  function resetChecklist() {
    setTasks([]);
  }

  return (
    <main className="app">
      <section className="checklist-shell">
        <div className="blob blob-one"></div>
        <div className="blob blob-two"></div>

        <div className="top-bar">
          <div>
            <p className="eyebrow">aesthetic productivity board</p>
            <h1>Khyati’s Checklist</h1>
            <p className="subtitle">
              Keep track of everything beautifully, one tiny win at a time.
            </p>
          </div>

          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>
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
            {filteredTasks.length === 0 ? (
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
                        <button onClick={() => saveEdit(task.id)}>Save</button>
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
                    <button onClick={() => startEditing(task)}>Edit</button>
                    <button onClick={() => deleteTask(task.id)}>Delete</button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        <div className="bottom-actions">
          <button onClick={clearCompleted}>Clear completed</button>
          <button onClick={resetChecklist}>Reset all</button>
        </div>
      </section>
    </main>
  );
}