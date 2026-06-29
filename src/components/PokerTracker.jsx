import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BarChart3,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "../supabaseClient";

function formatCurrency(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function getProfit(session) {
  return Number(session.cash_out || 0) - Number(session.buy_in || 0);
}

function StatCard({ title, value, icon: Icon, positive, negative }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-400">{title}</p>
        <div className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300">
          <Icon size={20} />
        </div>
      </div>

      <p
        className={`text-2xl font-bold ${
          positive ? "text-emerald-300" : negative ? "text-red-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function PokerTracker({ user }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("date-desc");

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    location: "",
    game_type: "Cash",
    stakes: "",
    buy_in: "",
    cash_out: "",
    hours: "",
    notes: "",
  });

  useEffect(() => {
    if (user?.id) {
      fetchSessions();
    }
  }, [user]);

  async function fetchSessions() {
    setLoading(true);

    const { data, error } = await supabase
      .from("poker_sessions")
      .select("*")
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching poker sessions:", error.message);
    } else {
      setSessions(data || []);
    }

    setLoading(false);
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.date || !form.buy_in || !form.cash_out || !form.hours) {
      alert("Please fill out date, buy-in, cash-out, and hours.");
      return;
    }

    const newSession = {
      user_id: user.id,
      date: form.date,
      location: form.location || "Unknown",
      game_type: form.game_type,
      stakes: form.stakes || "N/A",
      buy_in: Number(form.buy_in),
      cash_out: Number(form.cash_out),
      hours: Number(form.hours),
      notes: form.notes,
    };

    const { data, error } = await supabase
      .from("poker_sessions")
      .insert([newSession])
      .select()
      .single();

    if (error) {
      console.error("Error adding poker session:", error.message);
      alert("Could not add session.");
      return;
    }

    setSessions((prev) => [data, ...prev]);

    setForm({
      date: new Date().toISOString().slice(0, 10),
      location: "",
      game_type: "Cash",
      stakes: "",
      buy_in: "",
      cash_out: "",
      hours: "",
      notes: "",
    });
  }

  async function deleteSession(id) {
    const confirmed = window.confirm("Delete this poker session?");

    if (!confirmed) return;

    const { error } = await supabase.from("poker_sessions").delete().eq("id", id);

    if (error) {
      console.error("Error deleting poker session:", error.message);
      alert("Could not delete session.");
      return;
    }

    setSessions((prev) => prev.filter((session) => session.id !== id));
  }

  const stats = useMemo(() => {
    const totalProfit = sessions.reduce((sum, session) => sum + getProfit(session), 0);
    const totalHours = sessions.reduce(
      (sum, session) => sum + Number(session.hours || 0),
      0
    );
    const hourlyRate = totalHours > 0 ? totalProfit / totalHours : 0;

    const winningSessions = sessions.filter((session) => getProfit(session) > 0);
    const winRate =
      sessions.length > 0 ? (winningSessions.length / sessions.length) * 100 : 0;

    const bestSession =
      sessions.length > 0
        ? Math.max(...sessions.map((session) => getProfit(session)))
        : 0;

    const worstSession =
      sessions.length > 0
        ? Math.min(...sessions.map((session) => getProfit(session)))
        : 0;

    return {
      totalProfit,
      totalHours,
      hourlyRate,
      winRate,
      bestSession,
      worstSession,
      totalSessions: sessions.length,
    };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    if (filter !== "All") {
      result = result.filter((session) => session.game_type === filter);
    }

    result.sort((a, b) => {
      if (sortBy === "date-desc") return new Date(b.date) - new Date(a.date);
      if (sortBy === "date-asc") return new Date(a.date) - new Date(b.date);
      if (sortBy === "profit-desc") return getProfit(b) - getProfit(a);
      if (sortBy === "profit-asc") return getProfit(a) - getProfit(b);
      return 0;
    });

    return result;
  }, [sessions, filter, sortBy]);

  const bankrollChartData = useMemo(() => {
    let runningTotal = 0;

    return [...sessions]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((session) => {
        runningTotal += getProfit(session);

        return {
          date: session.date,
          bankroll: runningTotal,
          profit: getProfit(session),
        };
      });
  }, [sessions]);

  const profitBarData = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((session, index) => ({
        name: `S${index + 1}`,
        profit: getProfit(session),
        date: session.date,
      }));
  }, [sessions]);

  return (
    <div className="space-y-8">
      <header>
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
          <Banknote size={16} />
          Poker Earnings
        </div>

        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
          Poker Bankroll Tracker
        </h1>

        <p className="mt-2 max-w-2xl text-slate-400">
          Log each poker session and track your total profit, hourly rate, win
          rate, and bankroll progress.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Profit/Loss"
          value={formatCurrency(stats.totalProfit)}
          icon={DollarSign}
          positive={stats.totalProfit > 0}
          negative={stats.totalProfit < 0}
        />

        <StatCard
          title="Hourly Rate"
          value={`${formatCurrency(stats.hourlyRate)}/hr`}
          icon={Clock}
          positive={stats.hourlyRate > 0}
          negative={stats.hourlyRate < 0}
        />

        <StatCard
          title="Total Hours"
          value={Number(stats.totalHours || 0).toFixed(1)}
          icon={BarChart3}
        />

        <StatCard
          title="Win Rate"
          value={`${stats.winRate.toFixed(0)}%`}
          icon={Trophy}
          positive={stats.winRate >= 50}
          negative={stats.winRate < 50 && sessions.length > 0}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Sessions"
          value={stats.totalSessions}
          icon={Banknote}
        />

        <StatCard
          title="Best Session"
          value={formatCurrency(stats.bestSession)}
          icon={TrendingUp}
          positive={stats.bestSession > 0}
        />

        <StatCard
          title="Worst Session"
          value={formatCurrency(stats.worstSession)}
          icon={TrendingDown}
          negative={stats.worstSession < 0}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-lg">
          <div className="mb-5 flex items-center gap-2">
            <div className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300">
              <Plus size={20} />
            </div>
            <h2 className="text-xl font-bold">Add Session</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-300">Date</label>
              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="Casino, home game, online..."
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-slate-600"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Game Type
                </label>
                <select
                  name="game_type"
                  value={form.game_type}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white"
                >
                  <option>Cash</option>
                  <option>Tournament</option>
                  <option>Online</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Stakes
                </label>
                <input
                  type="text"
                  name="stakes"
                  value={form.stakes}
                  onChange={handleChange}
                  placeholder="1/3 NLH"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Buy-In
                </label>
                <input
                  type="number"
                  name="buy_in"
                  value={form.buy_in}
                  onChange={handleChange}
                  placeholder="300"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Cash-Out
                </label>
                <input
                  type="number"
                  name="cash_out"
                  value={form.cash_out}
                  onChange={handleChange}
                  placeholder="500"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-slate-300">
                  Hours
                </label>
                <input
                  type="number"
                  step="0.1"
                  name="hours"
                  value={form.hours}
                  onChange={handleChange}
                  placeholder="4.5"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-300">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                placeholder="How did the session go?"
                rows="3"
                className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-slate-600"
              />
            </div>

            <div className="rounded-xl bg-black/30 p-4">
              <p className="text-sm text-slate-400">Projected Profit/Loss</p>
              <p
                className={`text-2xl font-bold ${
                  Number(form.cash_out || 0) - Number(form.buy_in || 0) >= 0
                    ? "text-emerald-300"
                    : "text-red-300"
                }`}
              >
                {formatCurrency(
                  Number(form.cash_out || 0) - Number(form.buy_in || 0)
                )}
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950 transition hover:bg-emerald-300"
            >
              Add Poker Session
            </button>
          </form>
        </div>

        <div className="grid gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-lg">
            <h2 className="mb-5 text-xl font-bold">Bankroll Over Time</h2>

            <div className="h-72">
              {bankrollChartData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  Add sessions to see your chart.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bankrollChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        background: "#020617",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        color: "white",
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Line
                      type="monotone"
                      dataKey="bankroll"
                      stroke="#6ee7b7"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-lg">
            <h2 className="mb-5 text-xl font-bold">Profit by Session</h2>

            <div className="h-72">
              {profitBarData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  Add sessions to see profit by session.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitBarData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.1)"
                    />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={{
                        background: "#020617",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: "12px",
                        color: "white",
                      }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Bar dataKey="profit" radius={[8, 8, 0, 0]}>
                      {profitBarData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.profit >= 0 ? "#6ee7b7" : "#fca5a5"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-lg">
        <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-bold">Session History</h2>
            <p className="text-sm text-slate-400">
              Review all your logged poker sessions.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-white"
            >
              <option>All</option>
              <option>Cash</option>
              <option>Tournament</option>
              <option>Online</option>
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-white"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="profit-desc">Highest Profit</option>
              <option value="profit-asc">Lowest Profit</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-10 text-center text-slate-400">Loading sessions...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-left text-sm text-slate-400">
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Location</th>
                  <th className="py-3 pr-4">Type</th>
                  <th className="py-3 pr-4">Stakes</th>
                  <th className="py-3 pr-4">Buy-In</th>
                  <th className="py-3 pr-4">Cash-Out</th>
                  <th className="py-3 pr-4">Hours</th>
                  <th className="py-3 pr-4">Profit/Loss</th>
                  <th className="py-3 pr-4">Notes</th>
                  <th className="py-3 pr-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="py-8 text-center text-slate-400">
                      No poker sessions yet.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session) => {
                    const profit = getProfit(session);

                    return (
                      <tr
                        key={session.id}
                        className="border-b border-white/5 text-sm hover:bg-white/[0.03]"
                      >
                        <td className="py-4 pr-4 text-slate-300">
                          {session.date}
                        </td>
                        <td className="py-4 pr-4">{session.location}</td>
                        <td className="py-4 pr-4">
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                            {session.game_type}
                          </span>
                        </td>
                        <td className="py-4 pr-4">{session.stakes}</td>
                        <td className="py-4 pr-4 text-slate-300">
                          {formatCurrency(session.buy_in)}
                        </td>
                        <td className="py-4 pr-4 text-slate-300">
                          {formatCurrency(session.cash_out)}
                        </td>
                        <td className="py-4 pr-4 text-slate-300">
                          {session.hours}
                        </td>
                        <td
                          className={`py-4 pr-4 font-bold ${
                            profit >= 0 ? "text-emerald-300" : "text-red-300"
                          }`}
                        >
                          {formatCurrency(profit)}
                        </td>
                        <td className="max-w-[220px] truncate py-4 pr-4 text-slate-400">
                          {session.notes || "No notes"}
                        </td>
                        <td className="py-4 pr-4">
                          <button
                            onClick={() => deleteSession(session.id)}
                            className="rounded-lg bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/20"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}