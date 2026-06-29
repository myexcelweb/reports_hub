import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from tkcalendar import DateEntry
import duckdb
import pandas as pd
from pathlib import Path

class AdvancedReportGenerator:
    def __init__(self, root):
        self.root = root
        self.root.title("Court Case Report Generator - Advanced")
        self.root.geometry("1600x900")
        
        # Database connection
        self.conn = None
        self.db_path = None
        self.current_dataframe = None
        self.all_case_types = []
        
        self.create_widgets()
    
    def create_widgets(self):
        # Top Frame - Database Connection
        top_frame = tk.Frame(self.root, bg="darkblue", height=50)
        top_frame.pack(fill=tk.X)
        top_frame.pack_propagate(False)
        
        tk.Label(top_frame, text="Database File:", bg="darkblue", fg="white", 
                 font=("Arial", 10, "bold")).pack(side=tk.LEFT, padx=10)
        self.db_label = tk.Label(top_frame, text="No database loaded", bg="darkblue", 
                                  fg="red", font=("Arial", 10))
        self.db_label.pack(side=tk.LEFT, padx=5)
        
        tk.Button(top_frame, text="📂 Load Database", command=self.load_database,
                  bg="green", fg="white", font=("Arial", 10, "bold")).pack(side=tk.LEFT, padx=10)
        
        # Main Content Frame
        main_frame = tk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # Left Panel - Filters
        self.left_panel = tk.LabelFrame(main_frame, text="🔍 FILTERS", font=("Arial", 12, "bold"),
                                        fg="darkblue", width=450)
        self.left_panel.pack(side=tk.LEFT, fill=tk.Y, padx=5, pady=5)
        self.left_panel.pack_propagate(False)
        
        # Scrollable frame for filters
        filter_canvas = tk.Canvas(self.left_panel)
        scrollbar = tk.Scrollbar(self.left_panel, orient="vertical", command=filter_canvas.yview)
        self.scrollable_frame = tk.Frame(filter_canvas)
        
        self.scrollable_frame.bind("<Configure>", lambda e: filter_canvas.configure(scrollregion=filter_canvas.bbox("all")))
        filter_canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        filter_canvas.configure(yscrollcommand=scrollbar.set)
        
        filter_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Report Type Selection
        report_frame = tk.LabelFrame(self.scrollable_frame, text="📊 Report Type", font=("Arial", 10, "bold"))
        report_frame.pack(fill=tk.X, padx=10, pady=10)
        
        self.report_type = tk.StringVar(value="DATA_LIST")
        tk.Radiobutton(report_frame, text="📋 Data List", variable=self.report_type, 
                       value="DATA_LIST", font=("Arial", 10), command=self.toggle_report_options).pack(anchor=tk.W, padx=10, pady=5)
        tk.Radiobutton(report_frame, text="📊 Pivot Table", variable=self.report_type, 
                       value="PIVOT", font=("Arial", 10), command=self.toggle_report_options).pack(anchor=tk.W, padx=10, pady=5)
        
        # ============ COMMON FILTERS (Always Visible) ============
        common_frame = tk.LabelFrame(self.scrollable_frame, text="🔧 Common Filters", font=("Arial", 10, "bold"), fg="darkgreen")
        common_frame.pack(fill=tk.X, padx=10, pady=10)
        
        # Court Name Filter
        court_frame = tk.Frame(common_frame)
        court_frame.pack(fill=tk.X, padx=5, pady=5)
        tk.Label(court_frame, text="Court Name:", font=("Arial", 9, "bold")).pack(anchor=tk.W)
        
        court_btn_frame = tk.Frame(common_frame)
        court_btn_frame.pack(fill=tk.X, padx=5, pady=2)
        tk.Button(court_btn_frame, text="Select All", command=lambda: self.select_all(self.court_listbox),
                  bg="lightblue", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        tk.Button(court_btn_frame, text="Clear All", command=lambda: self.clear_all(self.court_listbox),
                  bg="lightcoral", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        
        self.court_listbox = tk.Listbox(common_frame, selectmode=tk.MULTIPLE, height=6, font=("Arial", 9))
        court_scrollbar = tk.Scrollbar(common_frame, orient=tk.VERTICAL, command=self.court_listbox.yview)
        self.court_listbox.configure(yscrollcommand=court_scrollbar.set)
        self.court_listbox.pack(fill=tk.X, padx=5, pady=5)
        court_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Status Filter
        status_frame = tk.Frame(common_frame)
        status_frame.pack(fill=tk.X, padx=5, pady=5)
        tk.Label(status_frame, text="Status:", font=("Arial", 9, "bold")).pack(anchor=tk.W)
        
        status_btn_frame = tk.Frame(common_frame)
        status_btn_frame.pack(fill=tk.X, padx=5, pady=2)
        tk.Button(status_btn_frame, text="Select All", command=lambda: self.select_all(self.status_listbox),
                  bg="lightblue", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        tk.Button(status_btn_frame, text="Clear All", command=lambda: self.clear_all(self.status_listbox),
                  bg="lightcoral", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        
        self.status_listbox = tk.Listbox(common_frame, selectmode=tk.MULTIPLE, height=3, font=("Arial", 9))
        for status in ['PENDING', 'DISPOSED']:
            self.status_listbox.insert(tk.END, status)
        self.status_listbox.pack(fill=tk.X, padx=5, pady=5)
        
        # Side Filter
        side_frame = tk.Frame(common_frame)
        side_frame.pack(fill=tk.X, padx=5, pady=5)
        tk.Label(side_frame, text="Side:", font=("Arial", 9, "bold")).pack(anchor=tk.W)
        
        side_btn_frame = tk.Frame(common_frame)
        side_btn_frame.pack(fill=tk.X, padx=5, pady=2)
        tk.Button(side_btn_frame, text="Select All", command=lambda: self.select_all(self.side_listbox),
                  bg="lightblue", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        tk.Button(side_btn_frame, text="Clear All", command=lambda: self.clear_all(self.side_listbox),
                  bg="lightcoral", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        
        self.side_listbox = tk.Listbox(common_frame, selectmode=tk.MULTIPLE, height=3, font=("Arial", 9))
        for side in ['CIVIL', 'CRIMINAL']:
            self.side_listbox.insert(tk.END, side)
        self.side_listbox.pack(fill=tk.X, padx=5, pady=5)
        
        # ============ CASE TYPE FILTER (With Search) ============
        case_type_frame = tk.LabelFrame(self.scrollable_frame, text="📝 Case Type Filter", font=("Arial", 10, "bold"), fg="darkblue")
        case_type_frame.pack(fill=tk.X, padx=10, pady=10)
        
        # Search box
        search_frame = tk.Frame(case_type_frame)
        search_frame.pack(fill=tk.X, padx=5, pady=5)
        tk.Label(search_frame, text="Search:", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        self.case_type_search = tk.Entry(search_frame, width=20)
        self.case_type_search.pack(side=tk.LEFT, padx=5)
        tk.Button(search_frame, text="🔍 Search", command=self.search_case_types,
                  bg="lightblue", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        tk.Button(search_frame, text="Show All", command=self.load_all_case_types,
                  bg="lightgreen", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        
        # Select All / Clear All for Case Type
        case_btn_frame = tk.Frame(case_type_frame)
        case_btn_frame.pack(fill=tk.X, padx=5, pady=2)
        tk.Button(case_btn_frame, text="Select All", command=lambda: self.select_all(self.case_type_listbox),
                  bg="lightblue", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        tk.Button(case_btn_frame, text="Clear All", command=lambda: self.clear_all(self.case_type_listbox),
                  bg="lightcoral", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        tk.Button(case_btn_frame, text="Select EX Cases", command=self.select_ex_cases,
                  bg="orange", fg="white", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        
        # Case Type Listbox with scrollbar
        case_list_frame = tk.Frame(case_type_frame)
        case_list_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        self.case_type_listbox = tk.Listbox(case_list_frame, selectmode=tk.MULTIPLE, height=6, font=("Arial", 9))
        case_scrollbar = tk.Scrollbar(case_list_frame, orient=tk.VERTICAL, command=self.case_type_listbox.yview)
        self.case_type_listbox.configure(yscrollcommand=case_scrollbar.set)
        
        self.case_type_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        case_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        # Date Ranges
        reg_date_frame = tk.LabelFrame(self.scrollable_frame, text="📅 Registration Date Range", font=("Arial", 10, "bold"))
        reg_date_frame.pack(fill=tk.X, padx=10, pady=10)
        
        from_frame = tk.Frame(reg_date_frame)
        from_frame.pack(fill=tk.X, padx=5, pady=5)
        tk.Label(from_frame, text="From:", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        self.reg_date_from = DateEntry(from_frame, width=12, background='darkblue', foreground='white', date_pattern='yyyy-mm-dd')
        self.reg_date_from.pack(side=tk.LEFT, padx=5)
        tk.Button(from_frame, text="Clear", command=lambda: self.reg_date_from.delete(0, tk.END),
                  bg="orange", fg="white", font=("Arial", 8)).pack(side=tk.LEFT, padx=5)
        
        to_frame = tk.Frame(reg_date_frame)
        to_frame.pack(fill=tk.X, padx=5, pady=5)
        tk.Label(to_frame, text="To:", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        self.reg_date_to = DateEntry(to_frame, width=12, background='darkblue', foreground='white', date_pattern='yyyy-mm-dd')
        self.reg_date_to.pack(side=tk.LEFT, padx=5)
        tk.Button(to_frame, text="Clear", command=lambda: self.reg_date_to.delete(0, tk.END),
                  bg="orange", fg="white", font=("Arial", 8)).pack(side=tk.LEFT, padx=5)
        
        dis_date_frame = tk.LabelFrame(self.scrollable_frame, text="📅 Disposal Date Range", font=("Arial", 10, "bold"))
        dis_date_frame.pack(fill=tk.X, padx=10, pady=10)
        
        from_frame2 = tk.Frame(dis_date_frame)
        from_frame2.pack(fill=tk.X, padx=5, pady=5)
        tk.Label(from_frame2, text="From:", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        self.dis_date_from = DateEntry(from_frame2, width=12, background='darkblue', foreground='white', date_pattern='yyyy-mm-dd')
        self.dis_date_from.pack(side=tk.LEFT, padx=5)
        tk.Button(from_frame2, text="Clear", command=lambda: self.dis_date_from.delete(0, tk.END),
                  bg="orange", fg="white", font=("Arial", 8)).pack(side=tk.LEFT, padx=5)
        
        to_frame2 = tk.Frame(dis_date_frame)
        to_frame2.pack(fill=tk.X, padx=5, pady=5)
        tk.Label(to_frame2, text="To:", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        self.dis_date_to = DateEntry(to_frame2, width=12, background='darkblue', foreground='white', date_pattern='yyyy-mm-dd')
        self.dis_date_to.pack(side=tk.LEFT, padx=5)
        tk.Button(to_frame2, text="Clear", command=lambda: self.dis_date_to.delete(0, tk.END),
                  bg="orange", fg="white", font=("Arial", 8)).pack(side=tk.LEFT, padx=5)
        
        # ============ DATA LIST SPECIFIC OPTIONS ============
        self.data_list_options = tk.LabelFrame(self.scrollable_frame, text="📋 Data List Options", font=("Arial", 10, "bold"), fg="blue")
        
        # Columns to display
        tk.Label(self.data_list_options, text="Columns to Display:", font=("Arial", 9, "bold")).pack(anchor=tk.W, padx=10, pady=2)
        self.display_columns = tk.Listbox(self.data_list_options, selectmode=tk.MULTIPLE, height=8)
        self.display_columns.pack(fill=tk.X, padx=10, pady=5)
        
        col_btn_frame = tk.Frame(self.data_list_options)
        col_btn_frame.pack(fill=tk.X, padx=10, pady=5)
        tk.Button(col_btn_frame, text="Select All", command=lambda: self.select_all(self.display_columns),
                  bg="lightblue", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        tk.Button(col_btn_frame, text="Clear All", command=lambda: self.clear_all(self.display_columns),
                  bg="lightcoral", font=("Arial", 8)).pack(side=tk.LEFT, padx=2)
        
        # Limit rows
        limit_frame = tk.Frame(self.data_list_options)
        limit_frame.pack(fill=tk.X, padx=10, pady=5)
        tk.Label(limit_frame, text="Max Rows:", font=("Arial", 9)).pack(side=tk.LEFT, padx=5)
        
        # Fixed: Use StringVar for Spinbox
        self.limit_var = tk.StringVar(value="10000")
        self.limit_rows = tk.Spinbox(limit_frame, from_=100, to=100000, width=10, textvariable=self.limit_var)
        self.limit_rows.pack(side=tk.LEFT, padx=5)
        
        # ============ PIVOT TABLE SPECIFIC OPTIONS ============
        self.pivot_options = tk.LabelFrame(self.scrollable_frame, text="📊 Pivot Table Options", font=("Arial", 10, "bold"), fg="purple")
        
        # Rows selection
        tk.Label(self.pivot_options, text="Rows:", font=("Arial", 9, "bold")).pack(anchor=tk.W, padx=10, pady=2)
        self.pivot_rows = tk.Listbox(self.pivot_options, selectmode=tk.MULTIPLE, height=4)
        self.pivot_rows.pack(fill=tk.X, padx=10, pady=5)
        
        # Columns selection
        tk.Label(self.pivot_options, text="Columns:", font=("Arial", 9, "bold")).pack(anchor=tk.W, padx=10, pady=2)
        self.pivot_cols = tk.Listbox(self.pivot_options, selectmode=tk.MULTIPLE, height=4)
        self.pivot_cols.pack(fill=tk.X, padx=10, pady=5)
        
        # Values selection
        tk.Label(self.pivot_options, text="Values (for aggregation):", font=("Arial", 9, "bold")).pack(anchor=tk.W, padx=10, pady=2)
        self.pivot_values = tk.Listbox(self.pivot_options, selectmode=tk.MULTIPLE, height=4)
        self.pivot_values.pack(fill=tk.X, padx=10, pady=5)
        
        # Aggregation function
        tk.Label(self.pivot_options, text="Aggregation:", font=("Arial", 9, "bold")).pack(anchor=tk.W, padx=10, pady=2)
        self.pivot_agg = ttk.Combobox(self.pivot_options, values=["COUNT", "SUM", "AVERAGE", "MIN", "MAX"])
        self.pivot_agg.set("COUNT")
        self.pivot_agg.pack(fill=tk.X, padx=10, pady=5)
        
        # Generate Report Button
        gen_btn_frame = tk.Frame(self.scrollable_frame)
        gen_btn_frame.pack(fill=tk.X, padx=10, pady=20)
        
        tk.Button(gen_btn_frame, text="🚀 GENERATE REPORT", command=self.generate_report,
                  bg="green", fg="white", font=("Arial", 12, "bold"), height=2).pack(fill=tk.X)
        
        tk.Button(gen_btn_frame, text="🔄 Reset All Filters", command=self.reset_filters,
                  bg="red", fg="white", font=("Arial", 10, "bold"), height=1).pack(fill=tk.X, pady=5)
        
        # Right Panel - Results
        right_panel = tk.Frame(main_frame)
        right_panel.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Report Title
        self.title_label = tk.Label(right_panel, text="Report Results", font=("Arial", 14, "bold"), fg="darkblue")
        self.title_label.pack(pady=5)
        
        # Export Buttons
        export_frame = tk.Frame(right_panel)
        export_frame.pack(fill=tk.X, pady=5)
        
        tk.Button(export_frame, text="📊 Export to Excel", command=self.export_to_excel,
                  bg="blue", fg="white", font=("Arial", 10, "bold")).pack(side=tk.LEFT, padx=5)
        tk.Button(export_frame, text="📈 Show Chart", command=self.show_chart,
                  bg="orange", fg="white", font=("Arial", 10, "bold")).pack(side=tk.LEFT, padx=5)
        
        # Results Treeview
        results_frame = tk.Frame(right_panel)
        results_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        tree_frame = tk.Frame(results_frame)
        tree_frame.pack(fill=tk.BOTH, expand=True)
        
        self.result_tree = ttk.Treeview(tree_frame, show="headings")
        vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=self.result_tree.yview)
        hsb = ttk.Scrollbar(tree_frame, orient="horizontal", command=self.result_tree.xview)
        self.result_tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        
        self.result_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        hsb.pack(side=tk.BOTTOM, fill=tk.X)
        
        # Status bar
        self.status_bar = tk.Label(self.root, text="Ready - Load a database to begin", 
                                   bd=1, relief=tk.SUNKEN, anchor=tk.W)
        self.status_bar.pack(side=tk.BOTTOM, fill=tk.X)
        
        # Initially hide report-specific options
        self.toggle_report_options()
    
    def toggle_report_options(self):
        """Show/hide options based on selected report type"""
        report_type = self.report_type.get()
        
        if report_type == "DATA_LIST":
            self.data_list_options.pack(fill=tk.X, padx=10, pady=10)
            self.pivot_options.pack_forget()
        else:  # PIVOT
            self.data_list_options.pack_forget()
            self.pivot_options.pack(fill=tk.X, padx=10, pady=10)
    
    def select_all(self, listbox):
        listbox.select_set(0, tk.END)
    
    def clear_all(self, listbox):
        listbox.selection_clear(0, tk.END)
    
    def select_ex_cases(self):
        """Select all case types containing 'EX'"""
        self.clear_all(self.case_type_listbox)
        for i in range(self.case_type_listbox.size()):
            case_type = self.case_type_listbox.get(i)
            if 'EX' in case_type.upper():
                self.case_type_listbox.selection_set(i)
        self.status_bar.config(text="Selected all EX case types")
    
    def search_case_types(self):
        """Search and highlight case types"""
        search_text = self.case_type_search.get().upper()
        if not search_text:
            self.load_all_case_types()
            return
        
        # Clear and show only matching items
        self.case_type_listbox.delete(0, tk.END)
        for case_type in self.all_case_types:
            if search_text in case_type.upper():
                self.case_type_listbox.insert(tk.END, case_type)
        
        self.status_bar.config(text=f"Found {self.case_type_listbox.size()} matching case types")
    
    def load_all_case_types(self):
        """Load all case types back"""
        self.case_type_listbox.delete(0, tk.END)
        for case_type in self.all_case_types:
            self.case_type_listbox.insert(tk.END, case_type)
        self.case_type_search.delete(0, tk.END)
        self.status_bar.config(text=f"Loaded all {len(self.all_case_types)} case types")
    
    def load_database(self):
        file_path = filedialog.askopenfilename(
            title="Select DuckDB Database",
            filetypes=[("DuckDB files", "*.db *.duckdb"), ("All files", "*.*")]
        )
        
        if file_path:
            try:
                if self.conn:
                    self.conn.close()
                
                self.db_path = file_path
                self.conn = duckdb.connect(file_path)
                
                # Check if connection is successful
                test = self.conn.execute("SELECT 1").fetchone()
                
                # Load distinct court names
                courts_df = self.conn.execute("SELECT DISTINCT COURT_NAME FROM main_data WHERE COURT_NAME IS NOT NULL ORDER BY COURT_NAME").fetchdf()
                self.court_listbox.delete(0, tk.END)
                for court in courts_df['COURT_NAME'].tolist():
                    self.court_listbox.insert(tk.END, court)
                
                # Load distinct case types
                case_types_df = self.conn.execute("SELECT DISTINCT CASE_TYPE FROM main_data WHERE CASE_TYPE IS NOT NULL ORDER BY CASE_TYPE").fetchdf()
                self.all_case_types = case_types_df['CASE_TYPE'].tolist()
                self.load_all_case_types()
                
                # Setup data list columns
                sample_df = self.conn.execute("SELECT * FROM main_data LIMIT 1").fetchdf()
                self.display_columns.delete(0, tk.END)
                for col in sample_df.columns:
                    self.display_columns.insert(tk.END, col)
                
                # Setup pivot options
                self.pivot_rows.delete(0, tk.END)
                self.pivot_cols.delete(0, tk.END)
                self.pivot_values.delete(0, tk.END)
                
                pivot_suggestions = ['COURT_NAME', 'DESIGNATION', 'STATUS', 'SIDE', 'STAGE']
                for col in pivot_suggestions:
                    if col in sample_df.columns:
                        self.pivot_rows.insert(tk.END, col)
                        self.pivot_cols.insert(tk.END, col)
                
                numeric_cols = ['CASE_AGE', 'CASE_AGED', 'AGE_REG', 'AGE_DIS']
                for col in numeric_cols:
                    if col in sample_df.columns:
                        self.pivot_values.insert(tk.END, col)
                
                self.db_label.config(text=f"✅ {Path(file_path).name}", fg="green")
                self.status_bar.config(text=f"Connected - {len(courts_df)} courts, {len(self.all_case_types)} case types")
                messagebox.showinfo("Success", "Database loaded successfully!")
                
            except Exception as e:
                messagebox.showerror("Error", f"Failed to connect: {str(e)}")
                self.db_label.config(text="Connection failed", fg="red")
                self.conn = None
    
    def get_selected_values(self, listbox):
        selected_indices = listbox.curselection()
        return [listbox.get(i) for i in selected_indices]
    
    def build_where_clause(self):
        """Build WHERE clause from filters"""
        conditions = []
        
        # Court filter
        selected_courts = self.get_selected_values(self.court_listbox)
        if selected_courts:
            court_list = "', '".join(selected_courts)
            conditions.append(f"COURT_NAME IN ('{court_list}')")
        
        # Status filter
        selected_status = self.get_selected_values(self.status_listbox)
        if selected_status:
            status_list = "', '".join(selected_status)
            conditions.append(f"UPPER(STATUS) IN ('{status_list}')")
        
        # Side filter
        selected_sides = self.get_selected_values(self.side_listbox)
        if selected_sides:
            side_list = "', '".join(selected_sides)
            conditions.append(f"UPPER(SIDE) IN ('{side_list}')")
        
        # Case Type filter
        selected_case_types = self.get_selected_values(self.case_type_listbox)
        if selected_case_types:
            case_list = "', '".join(selected_case_types)
            conditions.append(f"CASE_TYPE IN ('{case_list}')")
        
        # REG Date range
        reg_from = self.reg_date_from.get()
        if reg_from:
            conditions.append(f"REG_DATE >= DATE '{reg_from}'")
        
        reg_to = self.reg_date_to.get()
        if reg_to:
            conditions.append(f"REG_DATE <= DATE '{reg_to}'")
        
        # DIS Date range
        dis_from = self.dis_date_from.get()
        if dis_from:
            conditions.append(f"DIS_DATE >= DATE '{dis_from}'")
        
        dis_to = self.dis_date_to.get()
        if dis_to:
            conditions.append(f"DIS_DATE <= DATE '{dis_to}'")
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        return where_clause
    
    def generate_report(self):
        if not self.conn:
            messagebox.showwarning("Warning", "Please load a database first!")
            return
        
        report_type = self.report_type.get()
        where_clause = self.build_where_clause()
        
        try:
            if report_type == "DATA_LIST":
                self.generate_data_list(where_clause)
            else:
                self.generate_pivot_table(where_clause)
                
        except Exception as e:
            messagebox.showerror("Error", f"Failed to generate report: {str(e)}")
            self.status_bar.config(text=f"Error: {str(e)}")
    
    def generate_data_list(self, where_clause):
        """Generate data list report"""
        # Get selected columns
        selected_cols = self.get_selected_values(self.display_columns)
        if not selected_cols:
            selected_cols = ['COURT_NAME', 'CASE_NO', 'CASE_TYPE', 'SIDE', 'STATUS', 'REG_DATE', 'DIS_DATE', 'CASE_AGE']
        
        col_str = ', '.join([f'"{col}"' for col in selected_cols])
        limit = self.limit_var.get()  # Fixed: Use StringVar value
        
        sql = f"""
        SELECT {col_str}
        FROM main_data
        WHERE {where_clause}
        ORDER BY REG_DATE DESC
        LIMIT {limit}
        """
        
        df = self.conn.execute(sql).fetchdf()
        self.current_dataframe = df
        self.display_dataframe(df)
        self.title_label.config(text=f"📋 Data List Report - {len(df)} records found")
        self.status_bar.config(text=f"✅ Data List generated - {len(df)} records")
    
    def generate_pivot_table(self, where_clause):
        """Generate pivot table report"""
        # Get selected rows, columns, values
        rows = self.get_selected_values(self.pivot_rows)
        cols = self.get_selected_values(self.pivot_cols)
        values = self.get_selected_values(self.pivot_values)
        agg_func = self.pivot_agg.get().lower()
        
        if not rows or not values:
            messagebox.showwarning("Warning", "Please select at least one Row and one Value field")
            return
        
        # Get data
        select_cols = rows + cols + values
        select_cols = list(set(select_cols))
        
        sql = f"""
        SELECT {', '.join(select_cols)}
        FROM main_data
        WHERE {where_clause}
        """
        
        df = self.conn.execute(sql).fetchdf()
        
        if len(df) == 0:
            messagebox.showwarning("Warning", "No data available for the selected filters")
            return
        
        try:
            # Create pivot table
            pivot_df = None
            if agg_func == 'count':
                pivot_df = pd.pivot_table(df, index=rows, columns=cols if cols else None,
                                          values=values, aggfunc=len, fill_value=0)
            elif agg_func == 'sum':
                pivot_df = pd.pivot_table(df, index=rows, columns=cols if cols else None,
                                          values=values, aggfunc='sum', fill_value=0)
            elif agg_func == 'average':
                pivot_df = pd.pivot_table(df, index=rows, columns=cols if cols else None,
                                          values=values, aggfunc='mean', fill_value=0)
            elif agg_func == 'min':
                pivot_df = pd.pivot_table(df, index=rows, columns=cols if cols else None,
                                          values=values, aggfunc='min', fill_value=0)
            elif agg_func == 'max':
                pivot_df = pd.pivot_table(df, index=rows, columns=cols if cols else None,
                                          values=values, aggfunc='max', fill_value=0)
            
            if pivot_df is not None:
                # Reset index for display
                pivot_df = pivot_df.reset_index()
                
                self.current_dataframe = pivot_df
                self.display_dataframe(pivot_df)
                self.title_label.config(text=f"📊 Pivot Table - {agg_func.upper()} of {', '.join(values)}")
                self.status_bar.config(text=f"✅ Pivot table generated - {len(pivot_df)} rows, {len(pivot_df.columns)} columns")
            else:
                messagebox.showerror("Error", "Failed to create pivot table")
            
        except Exception as e:
            messagebox.showerror("Error", f"Failed to create pivot table: {str(e)}")
    
    def display_dataframe(self, df):
        """Display dataframe in treeview"""
        for item in self.result_tree.get_children():
            self.result_tree.delete(item)
        
        if len(df) == 0:
            self.status_bar.config(text="No data to display")
            return
        
        columns = list(df.columns)
        self.result_tree["columns"] = columns
        
        for col in columns:
            self.result_tree.heading(col, text=col, command=lambda c=col: self.sort_column(c))
            self.result_tree.column(col, width=120, minwidth=80)
        
        for idx, row in df.iterrows():
            values = [str(row[col]) for col in columns]
            self.result_tree.insert("", tk.END, values=values)
    
    def sort_column(self, col):
        if self.current_dataframe is not None:
            df_sorted = self.current_dataframe.sort_values(by=col)
            self.display_dataframe(df_sorted)
    
    def reset_filters(self):
        """Reset all filters"""
        self.clear_all(self.court_listbox)
        self.clear_all(self.status_listbox)
        self.clear_all(self.side_listbox)
        self.clear_all(self.case_type_listbox)
        self.reg_date_from.delete(0, tk.END)
        self.reg_date_to.delete(0, tk.END)
        self.dis_date_from.delete(0, tk.END)
        self.dis_date_to.delete(0, tk.END)
        self.case_type_search.delete(0, tk.END)
        self.load_all_case_types()
        self.status_bar.config(text="All filters reset")
    
    def export_to_excel(self):
        """Export current report to Excel"""
        if self.current_dataframe is None or len(self.current_dataframe) == 0:
            messagebox.showwarning("Warning", "No data to export! Generate a report first.")
            return
        
        file_path = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")]
        )
        
        if file_path:
            try:
                with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
                    self.current_dataframe.to_excel(writer, sheet_name="Report", index=False)
                    
                    worksheet = writer.sheets["Report"]
                    for idx, col in enumerate(self.current_dataframe.columns):
                        max_length = max(
                            self.current_dataframe[col].astype(str).map(len).max() if len(self.current_dataframe) > 0 else 0,
                            len(str(col))
                        )
                        worksheet.column_dimensions[chr(65 + idx)].width = min(max_length + 2, 50)
                
                self.status_bar.config(text=f"✅ Exported to: {file_path}")
                messagebox.showinfo("Success", f"Report exported to:\n{file_path}")
                
            except Exception as e:
                messagebox.showerror("Error", f"Failed to export: {str(e)}")
    
    def show_chart(self):
        """Show chart of current data"""
        if self.current_dataframe is None or len(self.current_dataframe) == 0:
            messagebox.showwarning("Warning", "No data to chart!")
            return
        
        try:
            import matplotlib.pyplot as plt
            from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
            
            chart_window = tk.Toplevel(self.root)
            chart_window.title("Report Chart")
            chart_window.geometry("800x600")
            
            numeric_cols = self.current_dataframe.select_dtypes(include=['number']).columns.tolist()
            
            if len(numeric_cols) >= 1 and len(self.current_dataframe) > 0:
                fig, ax = plt.subplots(figsize=(10, 6))
                
                x_col = self.current_dataframe.columns[0]
                y_col = numeric_cols[0]
                
                plot_data = self.current_dataframe.head(20)
                
                ax.bar(plot_data[x_col].astype(str), plot_data[y_col])
                ax.set_xlabel(x_col)
                ax.set_ylabel(y_col)
                ax.set_title(self.title_label.cget('text'))
                ax.tick_params(axis='x', rotation=45)
                
                canvas = FigureCanvasTkAgg(fig, master=chart_window)
                canvas.draw()
                canvas.get_tk_widget().pack(fill=tk.BOTH, expand=True)
            else:
                messagebox.showinfo("Info", "Need at least 1 numeric column for chart")
                
        except ImportError:
            messagebox.showwarning("Warning", "Matplotlib not installed. Install with: pip install matplotlib")

# Run the application
if __name__ == "__main__":
    root = tk.Tk()
    app = AdvancedReportGenerator(root)
    root.mainloop()