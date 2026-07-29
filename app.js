// ============================================================
// NOUS COMPLEX - ACCOUNT MANAGEMENT SYSTEM
// Complete JavaScript Application
// ============================================================

(() => {
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.SUPABASE_URL?.startsWith("https://") && !cfg.SUPABASE_ANON_KEY?.startsWith("PASTE_");
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const content = $("#page-content");
  
  const state = { 
    db: null, 
    user: null, 
    profile: null,
    page: "dashboard",
    students: [],
    classes: [],
    teachers: [],
    feeRecords: [],
    salaryRecords: [],
    expenses: [],
    expenseCategories: [],
    loading: false
  };
  
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const toLocalISODate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const isoToday = () => toLocalISODate(new Date());
  const esc = (v = "") => String(v).replace(/[&<>'"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[c]);
  const formatCurrency = (amount) => `PKR ${Number(amount).toFixed(2)}`;

  // Helper: Convert empty string to null for date fields
  const cleanDate = (value) => {
    if (!value || value === '') return null;
    return value;
  };

  // Helper: Convert empty string to null for UUID fields
  const cleanUUID = (value) => {
    if (!value || value === '') return null;
    return value;
  };

  // Helper: Clean form data - convert empty strings to null for date and UUID fields
  const cleanFormData = (data) => {
    const cleaned = {};
    const dateFields = [
      'joining_date', 'exit_date', 'increment_date', 'concession_date',
      'increment_date', 'decrement_date', 'payment_date', 'date'
    ];
    const uuidFields = [
      'class_id', 'teacher_id', 'student_id', 'category_id'
    ];
    
    for (const [key, value] of Object.entries(data)) {
      if (dateFields.includes(key)) {
        cleaned[key] = cleanDate(value);
      } else if (uuidFields.includes(key)) {
        cleaned[key] = cleanUUID(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  };

  const flash = (message, error = false) => { 
    const el = $("#flash"); 
    el.textContent = message; 
    el.className = `flash ${error ? "error" : "success"}`; 
    el.style.display = "block"; 
    setTimeout(() => el.style.display = "none", 4500); 
  };
  
  const setTemplate = id => { content.replaceChildren($(id).content.cloneNode(true)); };
  const empty = text => `<div class="empty">${esc(text)}</div>`;
  const isAdmin = () => state.profile?.role === "admin";

  let loadingHidden = false;
  
  function hideLoadingScreen() {
    if (loadingHidden) return;
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) { loadingScreen.style.display = 'none'; loadingHidden = true; }
  }
  
  function showLoadingScreen(message = 'Loading...') {
    const loadingScreen = document.getElementById('loading-screen');
    const messageEl = document.getElementById('loading-message');
    if (loadingScreen) loadingScreen.style.display = 'flex';
    if (messageEl) messageEl.textContent = message;
    loadingHidden = false;
  }

  async function api(run) { 
    const { data, error } = await run; 
    if (error) throw error; 
    return data; 
  }

  // ============================================================
  // SESSION MANAGEMENT
  // ============================================================
  
  async function loadSession() {
    if (state.loading) return;
    state.loading = true;
    try {
      showLoadingScreen('Checking session...');
      const { data: { session } } = await state.db.auth.getSession();
      if (!session) { 
        hideLoadingScreen(); 
        state.loading = false; 
        return showAuth(); 
      }
      
      state.user = session.user;
      showLoadingScreen('Loading profile...');
      
      const profile = await api(state.db.from("profiles").select("*").eq("id", state.user.id).single());
      state.profile = profile;
      
      const displayName = state.profile.full_name || state.profile.email;
      $("#user-name").textContent = displayName;
      $("#user-role").textContent = state.profile.role;
      
      $("#auth-screen").classList.add("hidden"); 
      $("#app").classList.remove("hidden");
      $("#menu-toggle-btn")?.classList.remove("is-hidden");
      
      await loadAllData();
      
      const savedPage = localStorage.getItem('nousomplex_accounts_last_page');
      if (savedPage && ['dashboard', 'students', 'classes', 'teachers', 'fee', 'salary', 'expenses', 'balance-sheet'].includes(savedPage)) {
        await navigate(savedPage);
      } else {
        await navigate("dashboard");
      }
      
      hideLoadingScreen();
      state.loading = false;
    } catch (error) {
      console.error('Session loading error:', error);
      hideLoadingScreen();
      state.loading = false;
      showAuth();
    }
  }

  async function loadAllData() {
    try {
      state.students = await api(state.db.from("students").select("*").order("name"));
      state.classes = await api(state.db.from("classes").select("*").order("name"));
      state.teachers = await api(state.db.from("teachers").select("*").order("name"));
      state.feeRecords = await api(state.db.from("fee_payments").select("*").order("payment_date", { ascending: false }));
      state.salaryRecords = await api(state.db.from("salary_payments").select("*").order("payment_date", { ascending: false }));
      state.expenses = await api(state.db.from("expenses").select("*").order("date", { ascending: false }));
      state.expenseCategories = await api(state.db.from("expense_categories").select("*").order("name"));
    } catch (e) {
      console.warn('Could not load all data:', e);
    }
  }

  function showAuth() { 
    state.user = state.profile = null; 
    $("#app").classList.add("hidden"); 
    $("#auth-screen").classList.remove("hidden");
    $("#menu-toggle-btn")?.classList.add("is-hidden");
    hideLoadingScreen();
  }

  // ============================================================
  // AUTHENTICATION
  // ============================================================
  
  async function signIn(event) {
    event.preventDefault(); 
    if (!configured) return;
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    if (!email || !password) { 
      $("#auth-message").textContent = "Please enter both email and password."; 
      return; 
    }
    showLoadingScreen('Signing in...');
    try { 
      await api(state.db.auth.signInWithPassword({ email, password })); 
      await loadSession(); 
    } catch (e) { 
      $("#auth-message").textContent = e.message; 
      hideLoadingScreen();
    }
  }

  async function signUp() {
    if (!configured) return;
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;
    if (!email || !password || password.length < 8) {
      return $("#auth-message").textContent = "Enter an email and a password of at least 8 characters first.";
    }
    showLoadingScreen('Creating account...');
    try { 
      await api(state.db.auth.signUp({ 
        email, 
        password, 
        options: { data: { full_name: email.split("@")[0] } } 
      })); 
      $("#auth-message").textContent = "Account created. Check your email to confirm it."; 
      hideLoadingScreen();
    } catch (e) { 
      $("#auth-message").textContent = e.message; 
      hideLoadingScreen();
    }
  }

  async function forgotPassword() {
    const email = $("#auth-email").value.trim();
    if (!email) { 
      $("#auth-message").textContent = "Please enter your email address first."; 
      return; 
    }
    showLoadingScreen('Sending reset email...');
    try {
      await api(state.db.auth.resetPasswordForEmail(email, { 
        redirectTo: window.location.origin 
      }));
      $("#auth-message").textContent = "Password reset email sent. Check your inbox.";
      hideLoadingScreen();
    } catch (e) { 
      $("#auth-message").textContent = e.message; 
      hideLoadingScreen();
    }
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  
  async function navigate(page) {
    state.page = page; 
    localStorage.setItem('nousomplex_accounts_last_page', page);
    
    document.querySelectorAll("#nav button").forEach(b => 
      b.classList.toggle("active", b.dataset.page === page)
    );
    
    const titles = { 
      dashboard: "Dashboard", 
      students: "Students", 
      classes: "Classes", 
      teachers: "Teachers", 
      fee: "Fee Collection", 
      salary: "Pay Salary", 
      expenses: "Expenses", 
      "balance-sheet": "Balance Sheet" 
    };
    
    $("#page-title").textContent = titles[page] || "Dashboard";
    $("#today").textContent = fmt.format(new Date()); 
    
    try { 
      await ({ 
        dashboard, students, classes, teachers, fee, salary, expenses, 
        "balance-sheet": balanceSheet 
      })[page](); 
    } catch (e) { 
      content.innerHTML = empty(e.message); 
      flash(e.message, true); 
    }
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  
  async function dashboard() {
    setTemplate("#dashboard-template");
    await loadAllData();
    
    const totalStudents = state.students.filter(s => s.active !== false).length;
    const totalTeachers = state.teachers.filter(t => t.active !== false).length;
    const totalFee = state.feeRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalSalary = state.salaryRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalExpenses = state.expenses.reduce((sum, r) => sum + (r.amount || 0), 0);
    const netBalance = totalFee - totalSalary - totalExpenses;

    $("[data-stat='students']").textContent = totalStudents;
    $("[data-stat='fee-collected']").textContent = formatCurrency(totalFee);
    $("[data-stat='teachers']").textContent = totalTeachers;
    $("[data-stat='salary-paid']").textContent = formatCurrency(totalSalary);
    $("[data-stat='expenses']").textContent = formatCurrency(totalExpenses);
    $("[data-stat='net-balance']").textContent = formatCurrency(netBalance);

    // Recent transactions
    const allTxns = [
      ...state.feeRecords.map(r => ({ ...r, type: 'Fee', label: `Fee - ${r.student_name || 'Student'}` })),
      ...state.salaryRecords.map(r => ({ ...r, type: 'Salary', label: `Salary - ${r.teacher_name || 'Teacher'}` })),
      ...state.expenses.map(r => ({ ...r, type: 'Expense', label: `Expense - ${r.category_name || r.description}` }))
    ].sort((a, b) => new Date(b.date || b.payment_date) - new Date(a.date || a.payment_date)).slice(0, 10);

    if (allTxns.length) {
      $("#recent-transactions").innerHTML = `
        <div class="table-wrap"><table>
          <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th></tr></thead>
          <tbody>${allTxns.map(t => `
            <tr>
              <td>${esc(t.date || t.payment_date || '')}</td>
              <td><span class="status ${t.type === 'Fee' ? 'active' : t.type === 'Salary' ? 'pending' : 'inactive'}">${t.type}</span></td>
              <td>${esc(t.label)}</td>
              <td class="${t.type === 'Fee' ? 'amount-positive' : 'amount-negative'}">${formatCurrency(t.amount)}</td>
            </tr>
          `).join('')}</tbody>
        </table></div>`;
    } else {
      $("#recent-transactions").innerHTML = empty("No transactions recorded yet.");
    }
  }

  // ============================================================
  // STUDENTS
  // ============================================================
  
  async function students() {
    setTemplate("#students-template");
    await loadAllData();
    populateClassFilter('student-class-filter');
    renderStudentsTable();
    $("#student-class-filter").onchange = renderStudentsTable;
    $("#student-status-filter").onchange = renderStudentsTable;
    $("#add-student").onclick = () => showStudentForm();
  }

  function renderStudentsTable() {
    const filterClass = $("#student-class-filter").value;
    const filterStatus = $("#student-status-filter").value;
    let filtered = state.students;
    if (filterClass) filtered = filtered.filter(s => s.class_id === filterClass);
    if (filterStatus) filtered = filtered.filter(s => filterStatus === 'active' ? s.active !== false : s.active === false);
    const classMap = Object.fromEntries(state.classes.map(c => [c.id, c]));
    
    $("#students-table").innerHTML = filtered.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Roll No</th><th>Name</th><th>Class</th><th>Course</th><th>Batch</th><th>Fee</th><th>Concession</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${filtered.map(s => {
          const cls = classMap[s.class_id];
          return `<tr>
            <td>${esc(s.roll_number || '')}</td>
            <td>${esc(s.name)}</td>
            <td>${cls ? esc(cls.name) + (cls.section ? ' — ' + esc(cls.section) : '') : '—'}</td>
            <td>${esc(s.course_name || '')}</td>
            <td>${esc(s.batch_no || '')}</td>
            <td>${formatCurrency(s.fee || 0)}</td>
            <td>${s.concession ? formatCurrency(s.concession) + (s.concession_date ? ' from ' + esc(s.concession_date) : '') : '—'}</td>
            <td><span class="status ${s.active !== false ? 'active' : 'inactive'}">${s.active !== false ? 'Active' : 'Inactive'}</span></td>
            <td class="row-actions">
              <button class="text-button edit-student" data-id="${s.id}">Edit</button>
              <button class="text-button toggle-student" data-id="${s.id}">${s.active !== false ? 'Deactivate' : 'Activate'}</button>
              <button class="danger delete-student" data-id="${s.id}">Delete</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : empty("No students found.");
    
    $$(".edit-student").forEach(btn => btn.onclick = () => showStudentForm(state.students.find(s => s.id === btn.dataset.id)));
    $$(".delete-student").forEach(btn => btn.onclick = () => deleteStudent(btn.dataset.id));
    $$(".toggle-student").forEach(btn => btn.onclick = () => toggleStudent(btn.dataset.id));
  }

  function showStudentForm(student = null) {
    const form = $("#student-form");
    form.classList.remove("hidden");
    const classOptions = state.classes.map(c => 
      `<option value="${c.id}" ${student?.class_id === c.id ? 'selected' : ''}>${esc(c.name)}${c.section ? ' — ' + esc(c.section) : ''}</option>`
    ).join('');
    
    form.innerHTML = `<form id="student-create">
      <div class="form-grid">
        <label>Name <input name="name" required value="${student ? esc(student.name) : ''}"></label>
        <label>Roll Number <input name="roll_number" value="${student ? esc(student.roll_number) : ''}"></label>
        <label>Class <select name="class_id">${classOptions}</select></label>
        <label>Course Name <input name="course_name" value="${student ? esc(student.course_name) : ''}"></label>
        <label>Batch Number <input name="batch_no" value="${student ? esc(student.batch_no) : ''}"></label>
        <label>Fee (PKR) <input name="fee" type="number" step="0.01" value="${student ? student.fee : ''}"></label>
        <label>Fee Increment <input name="fee_increment" type="number" step="0.01" value="${student ? student.fee_increment : ''}" placeholder="Amount"></label>
        <label>Increment Date <input name="increment_date" type="date" value="${student ? student.increment_date : ''}"></label>
        <label>Concession <input name="concession" type="number" step="0.01" value="${student ? student.concession : ''}" placeholder="Amount"></label>
        <label>Concession Date <input name="concession_date" type="date" value="${student ? student.concession_date : ''}"></label>
        <label>Joining Date <input name="joining_date" type="date" value="${student ? student.joining_date : ''}"></label>
        <label>Exit Date <input name="exit_date" type="date" value="${student ? student.exit_date : ''}"></label>
        <label>Status <select name="active"><option value="true" ${student?.active !== false ? 'selected' : ''}>Active</option><option value="false" ${student?.active === false ? 'selected' : ''}>Inactive</option></select></label>
      </div>
      <div class="toolbar">
        <button class="primary">${student ? 'Update Student' : 'Add Student'}</button>
        <button type="button" class="secondary" id="cancel-student-form">Cancel</button>
      </div>
    </form>`;
    
    $("#student-create").onsubmit = e => student ? updateStudent(e, student.id) : createStudent(e);
    $("#cancel-student-form").onclick = () => form.classList.add("hidden");
  }

  async function createStudent(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const rawData = Object.fromEntries(f.entries());
    
    const data = cleanFormData(rawData);
    data.fee = parseFloat(data.fee) || 0;
    data.fee_increment = parseFloat(data.fee_increment) || 0;
    data.concession = parseFloat(data.concession) || 0;
    data.active = data.active === 'true';
    
    try {
      await api(state.db.from("students").insert(data));
      flash("Student added successfully.");
      await loadAllData();
      students();
    } catch (err) { 
      console.error('Error creating student:', err);
      flash(err.message, true); 
    }
  }

  async function updateStudent(e, id) {
    e.preventDefault();
    const f = new FormData(e.target);
    const rawData = Object.fromEntries(f.entries());
    
    const data = cleanFormData(rawData);
    data.fee = parseFloat(data.fee) || 0;
    data.fee_increment = parseFloat(data.fee_increment) || 0;
    data.concession = parseFloat(data.concession) || 0;
    data.active = data.active === 'true';
    
    try {
      await api(state.db.from("students").update(data).eq("id", id));
      flash("Student updated successfully.");
      await loadAllData();
      students();
    } catch (err) { 
      console.error('Error updating student:', err);
      flash(err.message, true); 
    }
  }

  async function deleteStudent(id) {
    if (!confirm("Delete this student? This cannot be undone.")) return;
    try {
      await api(state.db.from("students").delete().eq("id", id));
      flash("Student deleted.");
      await loadAllData();
      students();
    } catch (err) { 
      flash(/foreign key|violat/i.test(err.message) ? "This student has fee records and cannot be deleted." : err.message, true); 
    }
  }

  async function toggleStudent(id) {
    const student = state.students.find(s => s.id === id);
    if (!student) return;
    try {
      await api(state.db.from("students").update({ active: student.active !== false ? false : true }).eq("id", id));
      flash(student.active !== false ? "Student deactivated." : "Student activated.");
      await loadAllData();
      students();
    } catch (err) { flash(err.message, true); }
  }

  // ============================================================
  // CLASSES
  // ============================================================
  
  async function classes() {
    setTemplate("#classes-template");
    await loadAllData();
    renderClassesTable();
    $("#add-class").onclick = () => showClassForm();
  }

  function renderClassesTable() {
    const teacherMap = Object.fromEntries(state.teachers.map(t => [t.id, t]));
    $("#classes-table").innerHTML = state.classes.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Section</th><th>Academic Year</th><th>Batch</th><th>Teacher</th><th>Actions</th></tr></thead>
        <tbody>${state.classes.map(c => {
          const teacher = teacherMap[c.teacher_id];
          return `<tr>
            <td>${esc(c.name)}</td>
            <td>${esc(c.section || '—')}</td>
            <td>${esc(c.academic_year || '—')}</td>
            <td>${esc(c.batch_no || '—')}</td>
            <td>${teacher ? esc(teacher.name) : 'Unassigned'}</td>
            <td class="row-actions">
              <button class="text-button edit-class" data-id="${c.id}">Edit</button>
              <button class="danger delete-class" data-id="${c.id}">Delete</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : empty("No classes found.");
    
    $$(".edit-class").forEach(btn => btn.onclick = () => showClassForm(state.classes.find(c => c.id === btn.dataset.id)));
    $$(".delete-class").forEach(btn => btn.onclick = () => deleteClass(btn.dataset.id));
  }

  function showClassForm(cls = null) {
    const form = $("#class-form");
    form.classList.remove("hidden");
    const teacherOptions = state.teachers.map(t => 
      `<option value="${t.id}" ${cls?.teacher_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`
    ).join('');
    
    form.innerHTML = `<form id="class-create">
      <div class="form-grid">
        <label>Name <input name="name" required value="${cls ? esc(cls.name) : ''}"></label>
        <label>Section <input name="section" value="${cls ? esc(cls.section) : 'A'}"></label>
        <label>Academic Year <input name="academic_year" value="${cls ? esc(cls.academic_year) : new Date().getFullYear()}"></label>
        <label>Batch Number <input name="batch_no" value="${cls ? esc(cls.batch_no) : ''}"></label>
        <label>Teacher <select name="teacher_id"><option value="">Unassigned</option>${teacherOptions}</select></label>
      </div>
      <div class="toolbar">
        <button class="primary">${cls ? 'Update Class' : 'Add Class'}</button>
        <button type="button" class="secondary" id="cancel-class-form">Cancel</button>
      </div>
    </form>`;
    
    $("#class-create").onsubmit = e => cls ? updateClass(e,
