import { useState } from 'react'
import './App.css'

const filters = ['All', 'Active', 'Completed']

function App() {
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Learn React basics', done: true },
    { id: 2, text: 'Style with CSS', done: false },
  ])
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('All')

  const addTask = (event) => {
    event.preventDefault()
    const text = input.trim()
    if (!text) return

    setTasks((currentTasks) => [
      ...currentTasks,
      { id: Date.now(), text, done: false },
    ])
    setInput('')
  }

  const toggleTask = (id) => {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    )
  }

  const deleteTask = (id) => {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id))
  }

  const clearCompleted = () => {
    setTasks((currentTasks) => currentTasks.filter((task) => !task.done))
  }

  const completed = tasks.filter((task) => task.done).length
  const remaining = tasks.length - completed
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
  const visibleTasks = tasks.filter((task) => {
    if (filter === 'Active') return !task.done
    if (filter === 'Completed') return task.done
    return true
  })

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Daylist home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="m6.5 12.5 3.4 3.4 7.8-8" />
            </svg>
          </span>
          <span>daylist</span>
        </a>
        <p className="topbar-note">
          <span className="status-dot" />
          A little progress goes a long way
        </p>
      </header>

      <main className="main-content">
        <section className="welcome-section" aria-labelledby="page-title">
          <div className="welcome-copy">
            <p className="eyebrow">YOUR PERSONAL SPACE</p>
            <h1 id="page-title">Make room for what matters.</h1>
            <p className="welcome-description">
              One thing at a time. You&apos;ve got this.
            </p>
          </div>

          <aside className="progress-card" aria-label="Task progress">
            <div className="progress-card-top">
              <span className="progress-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5 9.2 17 19 7" />
                </svg>
              </span>
              <span className="progress-label">TODAY&apos;S PROGRESS</span>
            </div>
            <p className="progress-count">
              <strong>{completed}</strong>
              <span>of {tasks.length} done</span>
            </p>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Tasks completed"
              aria-valuemin="0"
              aria-valuemax={tasks.length || 1}
              aria-valuenow={completed}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-caption">
              {remaining === 0
                ? 'Everything is wrapped up.'
                : `${remaining} ${remaining === 1 ? 'thing' : 'things'} left to focus on`}
            </p>
          </aside>
        </section>

        <section className="task-panel" aria-labelledby="tasks-heading">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">YOUR LIST</p>
              <h2 id="tasks-heading">Tasks</h2>
            </div>
            <span className="task-count" aria-live="polite">
              {remaining} left
            </span>
          </div>

          <form className="task-form" onSubmit={addTask}>
            <label className="visually-hidden" htmlFor="new-task">
              Add a task
            </label>
            <span className="input-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <input
              id="new-task"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="What needs your attention?"
            />
            <button type="submit" disabled={!input.trim()}>
              Add task
            </button>
          </form>

          <div className="list-toolbar">
            <div className="filter-tabs" role="group" aria-label="Filter tasks">
              {filters.map((name) => (
                <button
                  key={name}
                  className={filter === name ? 'filter-tab is-active' : 'filter-tab'}
                  type="button"
                  aria-pressed={filter === name}
                  onClick={() => setFilter(name)}
                >
                  {name}
                  {name === 'All' && <span className="filter-count">{tasks.length}</span>}
                </button>
              ))}
            </div>
            {completed > 0 && (
              <button
                className="clear-button"
                type="button"
                onClick={clearCompleted}
              >
                Clear completed
              </button>
            )}
          </div>

          {visibleTasks.length > 0 ? (
            <ul className="task-list">
              {visibleTasks.map((task) => (
                <li className={task.done ? 'task-item is-done' : 'task-item'} key={task.id}>
                  <label className="task-label">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => toggleTask(task.id)}
                    />
                    <span className="custom-checkbox" aria-hidden="true">
                      <svg viewBox="0 0 16 16" fill="none">
                        <path d="m3.5 8 3 3 6-6" />
                      </svg>
                    </span>
                    <span className="task-text">{task.text}</span>
                  </label>
                  <button
                    className="delete-button"
                    type="button"
                    onClick={() => deleteTask(task.id)}
                    aria-label={`Delete ${task.text}`}
                  >
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="m6 6 8 8m0-8-8 8" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">
                <svg viewBox="0 0 32 32" fill="none">
                  <path d="m8 16.5 5.2 5.2L24 11" />
                  <circle cx="16" cy="16" r="13" />
                </svg>
              </span>
              <p className="empty-title">
                {tasks.length === 0
                  ? 'A fresh start.'
                  : filter === 'Active'
                    ? 'Nothing left to do.'
                    : 'No completed tasks yet.'}
              </p>
              <p className="empty-description">
                {tasks.length === 0
                  ? 'Add your first task above and take it from there.'
                  : filter === 'Active'
                    ? 'Enjoy the breathing room, or add something new.'
                    : 'Completed tasks will show up here.'}
              </p>
            </div>
          )}
        </section>

        <footer className="page-footer">
          <span>Small steps, steady progress.</span>
          <span>Made for your day</span>
        </footer>
      </main>
    </div>
  )
}

export default App
