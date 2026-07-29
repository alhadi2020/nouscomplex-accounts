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
    const data = Object.fromEntries(f.entries());
    data.fee = parseFloat(data.fee) || 0;
    data.fee_increment = parseFloat(data.fee_increment) || 0;
    data.concession = parseFloat(data.concession) || 0;
    data.active = data.active === 'true';
    try {
      await api(state.db.from("students").insert(data));
      flash("Student added successfully.");
      await loadAllData();
      students();
    } catch (err) { flash(err.message, true); }
  }

  async function updateStudent(e, id) {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = Object.fromEntries(f.entries());
    data.fee = parseFloat(data.fee) || 0;
    data.fee_increment = parseFloat(data.fee_increment) || 0;
    data.concession = parseFloat(data.concession) || 0;
    data.active = data.active === 'true';
    try {
      await api(state.db.from("students").update(data).eq("id", id));
      flash("Student updated successfully.");
      await loadAllData();
      students();
    } catch (err) { flash(err.message, true); }
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
    
    $("#class-create").onsubmit = e => cls ? updateClass(e, cls.id) : createClass(e);
    $("#cancel-class-form").onclick = () => form.classList.add("hidden");
  }

  async function createClass(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = Object.fromEntries(f.entries());
    try {
      await api(state.db.from("classes").insert(data));
      flash("Class added.");
      await loadAllData();
      classes();
    } catch (err) { flash(err.message, true); }
  }

  async function updateClass(e, id) {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = Object.fromEntries(f.entries());
    try {
      await api(state.db.from("classes").update(data).eq("id", id));
      flash("Class updated.");
      await loadAllData();
      classes();
    } catch (err) { flash(err.message, true); }
  }

  async function deleteClass(id) {
    if (!confirm("Delete this class? This cannot be undone.")) return;
    try {
      await api(state.db.from("classes").delete().eq("id", id));
      flash("Class deleted.");
      await loadAllData();
      classes();
    } catch (err) { 
      flash(/foreign key|violat/i.test(err.message) ? "This class has students and cannot be deleted." : err.message, true); 
    }
  }

  // ============================================================
  // TEACHERS
  // ============================================================
  
  async function teachers() {
    setTemplate("#teachers-template");
    await loadAllData();
    renderTeachersTable();
    $("#add-teacher").onclick = () => showTeacherForm();
  }

  function renderTeachersTable() {
    const classMap = Object.fromEntries(state.classes.map(c => [c.id, c]));
    $("#teachers-table").innerHTML = state.teachers.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Class</th><th>Joining Date</th><th>Exit Date</th><th>Salary</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${state.teachers.map(t => {
          const cls = classMap[t.class_id];
          return `<tr>
            <td>${esc(t.name)}</td>
            <td>${cls ? esc(cls.name) : '—'}</td>
            <td>${esc(t.joining_date || '—')}</td>
            <td>${esc(t.exit_date || '—')}</td>
            <td>${formatCurrency(t.salary || 0)}</td>
            <td><span class="status ${t.active !== false ? 'active' : 'inactive'}">${t.active !== false ? 'Active' : 'Inactive'}</span></td>
            <td class="row-actions">
              <button class="text-button edit-teacher" data-id="${t.id}">Edit</button>
              <button class="text-button toggle-teacher" data-id="${t.id}">${t.active !== false ? 'Deactivate' : 'Activate'}</button>
              <button class="danger delete-teacher" data-id="${t.id}">Delete</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : empty("No teachers found.");
    
    $$(".edit-teacher").forEach(btn => btn.onclick = () => showTeacherForm(state.teachers.find(t => t.id === btn.dataset.id)));
    $$(".delete-teacher").forEach(btn => btn.onclick = () => deleteTeacher(btn.dataset.id));
    $$(".toggle-teacher").forEach(btn => btn.onclick = () => toggleTeacher(btn.dataset.id));
  }

  function showTeacherForm(teacher = null) {
    const form = $("#teacher-form");
    form.classList.remove("hidden");
    const classOptions = state.classes.map(c => 
      `<option value="${c.id}" ${teacher?.class_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`
    ).join('');
    
    form.innerHTML = `<form id="teacher-create">
      <div class="form-grid">
        <label>Name <input name="name" required value="${teacher ? esc(teacher.name) : ''}"></label>
        <label>Class <select name="class_id"><option value="">None</option>${classOptions}</select></label>
        <label>Joining Date <input name="joining_date" type="date" value="${teacher ? teacher.joining_date : ''}"></label>
        <label>Exit Date <input name="exit_date" type="date" value="${teacher ? teacher.exit_date : ''}"></label>
        <label>Salary (PKR) <input name="salary" type="number" step="0.01" value="${teacher ? teacher.salary : ''}"></label>
        <label>Increment <input name="increment" type="number" step="0.01" value="${teacher ? teacher.increment : ''}" placeholder="Amount"></label>
        <label>Increment Date <input name="increment_date" type="date" value="${teacher ? teacher.increment_date : ''}"></label>
        <label>Decrement <input name="decrement" type="number" step="0.01" value="${teacher ? teacher.decrement : ''}" placeholder="Amount"></label>
        <label>Decrement Date <input name="decrement_date" type="date" value="${teacher ? teacher.decrement_date : ''}"></label>
        <label>Leaves <input name="leaves" type="number" value="${teacher ? teacher.leaves : 0}" placeholder="Days"></label>
        <label>Status <select name="active"><option value="true" ${teacher?.active !== false ? 'selected' : ''}>Active</option><option value="false" ${teacher?.active === false ? 'selected' : ''}>Inactive</option></select></label>
      </div>
      <div class="toolbar">
        <button class="primary">${teacher ? 'Update Teacher' : 'Add Teacher'}</button>
        <button type="button" class="secondary" id="cancel-teacher-form">Cancel</button>
      </div>
    </form>`;
    
    $("#teacher-create").onsubmit = e => teacher ? updateTeacher(e, teacher.id) : createTeacher(e);
    $("#cancel-teacher-form").onclick = () => form.classList.add("hidden");
  }

  async function createTeacher(e) {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = Object.fromEntries(f.entries());
    data.salary = parseFloat(data.salary) || 0;
    data.increment = parseFloat(data.increment) || 0;
    data.decrement = parseFloat(data.decrement) || 0;
    data.leaves = parseInt(data.leaves) || 0;
    data.active = data.active === 'true';
    try {
      await api(state.db.from("teachers").insert(data));
      flash("Teacher added.");
      await loadAllData();
      teachers();
    } catch (err) { flash(err.message, true); }
  }

  async function updateTeacher(e, id) {
    e.preventDefault();
    const f = new FormData(e.target);
    const data = Object.fromEntries(f.entries());
    data.salary = parseFloat(data.salary) || 0;
    data.increment = parseFloat(data.increment) || 0;
    data.decrement = parseFloat(data.decrement) || 0;
    data.leaves = parseInt(data.leaves) || 0;
    data.active = data.active === 'true';
    try {
      await api(state.db.from("teachers").update(data).eq("id", id));
      flash("Teacher updated.");
      await loadAllData();
      teachers();
    } catch (err) { flash(err.message, true); }
  }

  async function deleteTeacher(id) {
    if (!confirm("Delete this teacher? This cannot be undone.")) return;
    try {
      await api(state.db.from("teachers").delete().eq("id", id));
      flash("Teacher deleted.");
      await loadAllData();
      teachers();
    } catch (err) { 
      flash(/foreign key|violat/i.test(err.message) ? "This teacher has salary records and cannot be deleted." : err.message, true); 
    }
  }

  async function toggleTeacher(id) {
    const teacher = state.teachers.find(t => t.id === id);
    if (!teacher) return;
    try {
      await api(state.db.from("teachers").update({ active: teacher.active !== false ? false : true }).eq("id", id));
      flash(teacher.active !== false ? "Teacher deactivated." : "Teacher activated.");
      await loadAllData();
      teachers();
    } catch (err) { flash(err.message, true); }
  }

  // ============================================================
  // FEE COLLECTION
  // ============================================================
  
  async function fee() {
    setTemplate("#fee-template");
    await loadAllData();
    populateStudentSelect('fee-student');
    $("#fee-date").value = isoToday();
    renderFeeHistory();
    $("#record-fee").onclick = recordFee;
  }

  function renderFeeHistory() {
    const studentMap = Object.fromEntries(state.students.map(s => [s.id, s]));
    $("#fee-history").innerHTML = state.feeRecords.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Student</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>${state.feeRecords.slice(0, 50).map(r => {
          const student = studentMap[r.student_id];
          return `<tr>
            <td>${student ? esc(student.name) : '—'}</td>
            <td class="amount-positive">${formatCurrency(r.amount)}</td>
            <td>${esc(r.payment_date || '')}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : empty("No fee records found.");
  }

  async function recordFee() {
    const studentId = $("#fee-student").value;
    const amount = parseFloat($("#fee-amount").value);
    const date = $("#fee-date").value;
    if (!studentId) { flash("Please select a student.", true); return; }
    if (!amount || amount <= 0) { flash("Please enter a valid amount.", true); return; }
    if (!date) { flash("Please select a date.", true); return; }
    const student = state.students.find(s => s.id === studentId);
    try {
      await api(state.db.from("fee_payments").insert({
        student_id: studentId,
        student_name: student?.name || '',
        amount: amount,
        payment_date: date
      }));
      flash("Fee payment recorded.");
      await loadAllData();
      fee();
    } catch (err) { flash(err.message, true); }
  }

  // ============================================================
  // SALARY PAYMENTS
  // ============================================================
  
  async function salary() {
    setTemplate("#salary-template");
    await loadAllData();
    populateTeacherSelect('salary-teacher');
    $("#salary-date").value = isoToday();
    renderSalaryHistory();
    $("#record-salary").onclick = recordSalary;
  }

  function renderSalaryHistory() {
    const teacherMap = Object.fromEntries(state.teachers.map(t => [t.id, t]));
    $("#salary-history").innerHTML = state.salaryRecords.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Teacher</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>${state.salaryRecords.slice(0, 50).map(r => {
          const teacher = teacherMap[r.teacher_id];
          return `<tr>
            <td>${teacher ? esc(teacher.name) : '—'}</td>
            <td class="amount-negative">${formatCurrency(r.amount)}</td>
            <td>${esc(r.payment_date || '')}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : empty("No salary records found.");
  }

  async function recordSalary() {
    const teacherId = $("#salary-teacher").value;
    const amount = parseFloat($("#salary-amount").value);
    const date = $("#salary-date").value;
    if (!teacherId) { flash("Please select a teacher.", true); return; }
    if (!amount || amount <= 0) { flash("Please enter a valid amount.", true); return; }
    if (!date) { flash("Please select a date.", true); return; }
    const teacher = state.teachers.find(t => t.id === teacherId);
    try {
      await api(state.db.from("salary_payments").insert({
        teacher_id: teacherId,
        teacher_name: teacher?.name || '',
        amount: amount,
        payment_date: date
      }));
      flash("Salary payment recorded.");
      await loadAllData();
      salary();
    } catch (err) { flash(err.message, true); }
  }

  // ============================================================
  // EXPENSES
  // ============================================================
  
  async function expenses() {
    setTemplate("#expenses-template");
    await loadAllData();
    populateExpenseCategories();
    $("#expense-date").value = isoToday();
    renderExpenses();
    $("#record-expense").onclick = recordExpense;
    $("#add-expense-category").onclick = () => showAddCategoryModal();
  }

  function populateExpenseCategories() {
    const select = $("#expense-category");
    select.innerHTML = `<option value="">Select Category</option>` + 
      state.expenseCategories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  }

  function renderExpenses() {
    const catMap = Object.fromEntries(state.expenseCategories.map(c => [c.id, c]));
    $("#expense-history").innerHTML = state.expenses.length ? `
      <div class="table-wrap"><table>
        <thead><tr><th>Category</th><th>Description</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>${state.expenses.slice(0, 50).map(r => {
          const cat = catMap[r.category_id];
          return `<tr>
            <td>${cat ? esc(cat.name) : '—'}</td>
            <td>${esc(r.description || '')}</td>
            <td class="amount-negative">${formatCurrency(r.amount)}</td>
            <td>${esc(r.date || '')}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : empty("No expenses recorded.");
  }

  async function recordExpense() {
    const categoryId = $("#expense-category").value;
    const description = $("#expense-description").value.trim();
    const amount = parseFloat($("#expense-amount").value);
    const date = $("#expense-date").value;
    if (!categoryId) { flash("Please select a category.", true); return; }
    if (!amount || amount <= 0) { flash("Please enter a valid amount.", true); return; }
    if (!date) { flash("Please select a date.", true); return; }
    try {
      await api(state.db.from("expenses").insert({
        category_id: categoryId,
        description: description || null,
        amount: amount,
        date: date
      }));
      flash("Expense recorded.");
      await loadAllData();
      expenses();
    } catch (err) { flash(err.message, true); }
  }

  function showAddCategoryModal() {
    const modal = document.getElementById('modal-overlay');
    const body = document.getElementById('modal-body');
    body.innerHTML = `
      <h2>Add Expense Category</h2>
      <div class="form-grid" style="grid-template-columns:1fr;">
        <label>Category Name <input id="new-category-name" placeholder="e.g., Utilities, Rent, Supplies"></label>
      </div>
      <div class="toolbar">
        <button id="save-category" class="primary">Save Category</button>
        <button id="cancel-category" class="secondary">Cancel</button>
      </div>
    `;
    modal.classList.add('show');
    
    document.getElementById('save-category').onclick = async () => {
      const name = document.getElementById('new-category-name').value.trim();
      if (!name) { flash("Please enter a category name.", true); return; }
      try {
        await api(state.db.from("expense_categories").insert({ name }));
        flash("Category added.");
        await loadAllData();
        modal.classList.remove('show');
        expenses();
      } catch (err) { flash(err.message, true); }
    };
    
    document.getElementById('cancel-category').onclick = () => modal.classList.remove('show');
    document.getElementById('modal-close').onclick = () => modal.classList.remove('show');
    modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('show'); };
  }

  // ============================================================
  // BALANCE SHEET
  // ============================================================
  
  async function balanceSheet() {
    setTemplate("#balance-sheet-template");
    await loadAllData();
    populateBalanceSheetFilters();
    $("#balance-year").onchange = renderBalanceSheet;
    $("#balance-month").onchange = renderBalanceSheet;
    $("#balance-view").onchange = renderBalanceSheet;
    renderBalanceSheet();
  }

  function populateBalanceSheetFilters() {
    const yearSelect = $("#balance-year");
    const currentYear = new Date().getFullYear();
    yearSelect.innerHTML = '';
    for (let y = currentYear - 5; y <= currentYear; y++) {
      yearSelect.innerHTML += `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`;
    }
    
    const monthSelect = $("#balance-month");
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    monthSelect.innerHTML = `<option value="">All Months</option>` + 
      months.map((m, i) => `<option value="${String(i + 1).padStart(2, '0')}">${m}</option>`).join('');
  }

  function renderBalanceSheet() {
    const year = parseInt($("#balance-year").value);
    const month = $("#balance-month").value;
    const view = $("#balance-view").value || 'summary';

    // Filter fee records
    let fees = state.feeRecords;
    if (year) fees = fees.filter(r => r.payment_date && new Date(r.payment_date).getFullYear() === year);
    if (month) fees = fees.filter(r => r.payment_date && String(new Date(r.payment_date).getMonth() + 1).padStart(2, '0') === month);

    // Filter salary records
    let salaries = state.salaryRecords;
    if (year) salaries = salaries.filter(r => r.payment_date && new Date(r.payment_date).getFullYear() === year);
    if (month) salaries = salaries.filter(r => r.payment_date && String(new Date(r.payment_date).getMonth() + 1).padStart(2, '0') === month);

    // Filter expenses
    let expenses = state.expenses;
    if (year) expenses = expenses.filter(r => r.date && new Date(r.date).getFullYear() === year);
    if (month) expenses = expenses.filter(r => r.date && String(new Date(r.date).getMonth() + 1).padStart(2, '0') === month);

    const totalFees = fees.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalSalaries = salaries.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, r) => sum + (r.amount || 0), 0);
    const netBalance = totalFees - totalSalaries - totalExpenses;

    const dateLabel = month ? `${new Date(year, parseInt(month) - 1).toLocaleString('default', { month: 'long' })} ${year}` : `Year ${year}`;

    let html = `
      <div class="stats" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
        <article class="green"><span>Total Fee Collected</span><strong>${formatCurrency(totalFees)}</strong></article>
        <article class="red"><span>Total Salary Paid</span><strong>${formatCurrency(totalSalaries)}</strong></article>
        <article class="red"><span>Total Expenses</span><strong>${formatCurrency(totalExpenses)}</strong></article>
        <article class="${netBalance >= 0 ? 'green' : 'red'}"><span>Net Balance (${dateLabel})</span><strong>${formatCurrency(netBalance)}</strong></article>
      </div>
    `;

    if (view === 'detailed') {
      html += `<div class="panel-heading" style="margin-top:20px;"><h2>Fee Collection Details</h2></div>`;
      if (fees.length) {
        html += `<div class="table-wrap"><table>
          <thead><tr><th>Student</th><th>Amount</th><th>Date</th></tr></thead>
          <tbody>${fees.map(r => `
            <tr><td>${esc(r.student_name || '—')}</td><td class="amount-positive">${formatCurrency(r.amount)}</td><td>${esc(r.payment_date || '')}</td></tr>
          `).join('')}</tbody>
        </table></div>`;
      } else {
        html += empty("No fee records.");
      }

      html += `<div class="panel-heading" style="margin-top:20px;"><h2>Salary Payments</h2></div>`;
      if (salaries.length) {
        html += `<div class="table-wrap"><table>
          <thead><tr><th>Teacher</th><th>Amount</th><th>Date</th></tr></thead>
          <tbody>${salaries.map(r => `
            <tr><td>${esc(r.teacher_name || '—')}</td><td class="amount-negative">${formatCurrency(r.amount)}</td><td>${esc(r.payment_date || '')}</td></tr>
          `).join('')}</tbody>
        </table></div>`;
      } else {
        html += empty("No salary records.");
      }

      html += `<div class="panel-heading" style="margin-top:20px;"><h2>Expenses</h2></div>`;
      if (expenses.length) {
        const catMap = Object.fromEntries(state.expenseCategories.map(c => [c.id, c]));
        html += `<div class="table-wrap"><table>
          <thead><tr><th>Category</th><th>Description</th><th>Amount</th><th>Date</th></tr></thead>
          <tbody>${expenses.map(r => {
            const cat = catMap[r.category_id];
            return `<tr><td>${cat ? esc(cat.name) : '—'}</td><td>${esc(r.description || '')}</td><td class="amount-negative">${formatCurrency(r.amount)}</td><td>${esc(r.date || '')}</td></tr>`;
          }).join('')}</tbody>
        </table></div>`;
      } else {
        html += empty("No expense records.");
      }
    }

    if (view === 'summary') {
      const dues = calculateDues();
      html += `<div class="panel" style="margin-top:20px;">
        <div class="panel-heading"><h2>Summary</h2></div>
        <div class="stats" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
          <article><span>Total Dues (Fee Outstanding)</span><strong>${formatCurrency(dues)}</strong></article>
          <article><span>Total Payable (Salary + Expenses)</span><strong>${formatCurrency(totalSalaries + totalExpenses)}</strong></article>
          <article class="${netBalance >= 0 ? 'green' : 'red'}"><span>Net Position</span><strong>${formatCurrency(netBalance)}</strong></article>
        </div>
      </div>`;
    }

    document.getElementById('balance-sheet-content').innerHTML = html;
  }

  function calculateDues() {
    const feeMap = {};
    state.feeRecords.forEach(r => {
      if (!feeMap[r.student_id]) feeMap[r.student_id] = 0;
      feeMap[r.student_id] += r.amount || 0;
    });
    let dues = 0;
    state.students.forEach(s => {
      if (s.active === false) return;
      const expectedFee = s.fee || 0;
      const collected = feeMap[s.id] || 0;
      if (expectedFee > collected) dues += (expectedFee - collected);
    });
    return dues;
  }

  // ============================================================
  // HELPERS
  // ============================================================
  
  function populateClassFilter(selectId) {
    const select = $(`#${selectId}`);
    if (!select) return;
    select.innerHTML = `<option value="">All Classes</option>` + 
      state.classes.map(c => `<option value="${c.id}">${esc(c.name)}${c.section ? ' — ' + esc(c.section) : ''}</option>`).join('');
  }

  function populateStudentSelect(selectId) {
    const select = $(`#${selectId}`);
    if (!select) return;
    select.innerHTML = `<option value="">Select Student</option>` + 
      state.students.filter(s => s.active !== false).map(s => `<option value="${s.id}">${esc(s.name)}${s.roll_number ? ' (' + esc(s.roll_number) + ')' : ''}</option>`).join('');
  }

  function populateTeacherSelect(selectId) {
    const select = $(`#${selectId}`);
    if (!select) return;
    select.innerHTML = `<option value="">Select Teacher</option>` + 
      state.teachers.filter(t => t.active !== false).map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  }

  // ============================================================
  // SIDEBAR
  // ============================================================
  
  function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================
  
  function init() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'flex';

    if (configured) {
      state.db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    }

    // Auth events
    $("#auth-form").onsubmit = signIn;
    $("#signup-button").onclick = signUp;
    $("#forgot-password-btn").onclick = forgotPassword;
    $("#signout").onclick = async () => {
      await state.db.auth.signOut();
      localStorage.removeItem('nousomplex_accounts_last_page');
      showAuth();
    };

    // Sidebar events
    const menuToggle = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const closeBtn = document.getElementById('sidebar-close-btn');

    if (menuToggle) menuToggle.addEventListener('click', () => {
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
    if (overlay) overlay.addEventListener('click', closeSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

    // Navigation
    document.addEventListener('click', function(e) {
      const button = e.target.closest('#nav button[data-page]');
      if (button) { 
        e.preventDefault(); 
        const page = button.dataset.page; 
        if (page) navigate(page); 
        if (window.innerWidth <= 768) setTimeout(closeSidebar, 300);
      }
    });

    // Modal close
    document.getElementById('modal-close').onclick = () => 
      document.getElementById('modal-overlay').classList.remove('show');

    if (configured) {
      setTimeout(() => loadSession(), 100);
    } else {
      hideLoadingScreen();
      $("#auth-message").textContent = "Add your Supabase Project URL and anon key to config.js before signing in.";
    }
  }

  // Start the app
  init();
})();