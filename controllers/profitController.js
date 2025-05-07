import db from "../db/db.js";

const calculateProfit = (req, res) => {
  const { adminId, startDate, endDate, range } = req.query;

  if (!adminId || !startDate || !endDate) {
    return res.status(400).json({ 
      success: false, 
      message: "Admin ID, start date, and end date are required" 
    });
  }

  console.log("Calculate Profit - adminId:", adminId, "startDate:", startDate, "endDate:", endDate, "range:", range);

  // Fetch expenses for the date range
  const startOfStartDate = new Date(`${startDate}T00:00:00.000Z`);
  const endOfEndDate = new Date(`${endDate}T23:59:59.999Z`);
  const startOfStartDateLocal = startOfStartDate.toISOString().slice(0, 19).replace('T', ' ');
  const endOfEndDateLocal = endOfEndDate.toISOString().slice(0, 19).replace('T', ' ');

  console.log("Expenses Date Range (Local):", startOfStartDateLocal, "to", endOfEndDateLocal);

  db.query(
    `SELECT SUM(amount) as totalExpenses 
     FROM expenses 
     WHERE admin_id = ? AND created_at BETWEEN ? AND ?`,
    [adminId, startOfStartDateLocal, endOfEndDateLocal],
    (error, expenseResults) => {
      if (error) {
        console.error("Error fetching expenses:", error);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to fetch expenses" 
        });
      }

      console.log("Expenses Query Result:", expenseResults);
      const totalExpenses = parseFloat(expenseResults[0].totalExpenses || 0);
      console.log("Total Expenses:", totalExpenses);

      // Fetch bills for the date range (income)
      const startOfStartDateIST = new Date(startOfStartDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const endOfEndDateIST = new Date(endOfEndDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

      console.log("Bills Date Range (IST):", startOfStartDateIST, "to", endOfEndDateIST);

      db.query(
        `SELECT SUM(total_bill) as totalIncome 
         FROM bills 
         WHERE admin_id = ? AND date BETWEEN ? AND ?`,
        [adminId, startOfStartDateIST, endOfEndDateIST],
        (billError, billResults) => {
          if (billError) {
            console.error("Error fetching bills:", billError);
            return res.status(500).json({ 
              success: false, 
              message: "Failed to fetch bills" 
            });
          }

          console.log("Bills Query Result:", billResults);
          const totalIncome = parseFloat(billResults[0].totalIncome || 0);
          console.log("Total Income:", totalIncome);
          const profit = totalIncome - totalExpenses;

          res.status(200).json({
            success: true,
            data: {
              profit,
              expenses: totalExpenses,
              income: totalIncome,
            },
          });
        }
      );
    }
  );
};

const getFinanceSummary = (req, res) => {
  const { adminId, startDate, endDate } = req.query;

  if (!adminId || !startDate || !endDate) {
    return res.status(400).json({ 
      success: false, 
      message: "Admin ID, start date, and end date are required" 
    });
  }

  console.log("Finance Summary - adminId:", adminId, "startDate:", startDate, "endDate:", endDate);

  // Fetch expenses for the date range
  const startOfStartDate = new Date(`${startDate}T00:00:00.000Z`);
  const endOfEndDate = new Date(`${endDate}T23:59:59.999Z`);
  const startOfStartDateLocal = startOfStartDate.toISOString().slice(0, 19).replace('T', ' ');
  const endOfEndDateLocal = endOfEndDate.toISOString().slice(0, 19).replace('T', ' ');

  console.log("Expenses Date Range (Local):", startOfStartDateLocal, "to", endOfEndDateLocal);

db.query(
    `SELECT SUM(amount) as totalExpenses 
     FROM expenses 
     WHERE admin_id = ? AND created_at BETWEEN ? AND ?`,
    [adminId, startOfStartDateLocal, endOfEndDateLocal],
    (error, expenseResults) => {
      if (error) {
        console.error("Error fetching expenses:", error);
        return res.status(500).json({ 
          success: false, 
          message: "Failed to fetch expenses" 
        });
      }

      const totalExpenses = parseFloat(expenseResults[0].totalExpenses || 0);

      const startOfStartDateIST = new Date(startOfStartDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      const endOfEndDateIST = new Date(endOfEndDate.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

      db.query(
        `SELECT SUM(total_bill) as totalIncome 
         FROM bills 
         WHERE admin_id = ? AND date BETWEEN ? AND ?`,
        [adminId, startOfStartDateIST, endOfEndDateIST],
        (billError, billResults) => {
          if (billError) {
            console.error("Error fetching bills:", billError);
            return res.status(500).json({ 
              success: false, 
              message: "Failed to fetch bills" 
            });
          }

          const totalIncome = parseFloat(billResults[0].totalIncome || 0);
          const netBalance = totalIncome - totalExpenses;

          // Fetch detailed expenses by payee
          db.query(
            `SELECT payee_name AS name, SUM(amount) as expense, DATE(created_at) AS date 
             FROM expenses 
             WHERE admin_id = ? AND created_at BETWEEN ? AND ?
             GROUP BY payee_name, DATE(created_at)`,
            [adminId, startOfStartDateLocal, endOfEndDateLocal],
            (detailExpenseError, detailExpenseResults) => {
              if (detailExpenseError) {
                console.error("Error fetching detailed expenses:", detailExpenseError);
                return res.status(500).json({ 
                  success: false, 
                  message: "Failed to fetch detailed expenses" 
                });
              }

              // Fetch detailed income by customer
              db.query(
                `SELECT customer_name AS name, SUM(total_bill) as income, DATE(date) AS date 
                 FROM bills 
                 WHERE admin_id = ? AND date BETWEEN ? AND ?
                 GROUP BY customer_name, DATE(date)`,
                [adminId, startOfStartDateIST, endOfEndDateIST],
                (detailBillError, detailBillResults) => {
                  if (detailBillError) {
                    console.error("Error fetching detailed bills:", detailBillError);
                    return res.status(500).json({ 
                      success: false, 
                      message: "Failed to fetch detailed bills" 
                    });
                  }

                  // Combine expenses and income into a single list
                  const detailsMap = new Map();

                  // Process expenses
                  detailExpenseResults.forEach(item => {
                    const key = `${item.name}-${item.date}`;
                    detailsMap.set(key, {
                      name: item.name,
                      expense: parseFloat(item.expense) || 0,
                      income: 0,
                      date: item.date,
                    });
                  });

                  // Process income
                  detailBillResults.forEach(item => {
                    const key = `${item.name}-${item.date}`;
                    if (detailsMap.has(key)) {
                      const entry = detailsMap.get(key);
                      entry.income = parseFloat(item.income) || 0;
                    } else {
                      detailsMap.set(key, {
                        name: item.name,
                        expense: 0,
                        income: parseFloat(item.income) || 0,
                        date: item.date,
                      });
                    }
                  });

                  const details = Array.from(detailsMap.values());
                  // Sort by date in descending order
                  details.sort((a, b) => new Date(b.date) - new Date(a.date));

                  res.status(200).json({
                    success: true,
                    data: {
                      netBalance,
                      expenses: totalExpenses,
                      income: totalIncome,
                      details,
                    },
                  });
                }
              );
            }
          );
        }
      );
    }
  );
};

export default {
  calculateProfit,
  getFinanceSummary,
};