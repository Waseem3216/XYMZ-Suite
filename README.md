# To start the backend server:

cd backend

npm install

npm run dev

# To start the frontend

Click on Go Live OR Open a new terminal and type follow the exact same steps you followed for backend

## To view and check out the SQLite database file as a DB (Rows+Columns), open a terminal and Type the following:

cd /Users/was33xymz/path/to/taskdesk/backend OR 
cd backend

sqlite3 taskdesk.db

.tables          -- list all tables
.schema          -- show schema for all tables
.schema tasks    -- show schema for a specific table
SELECT * FROM tasks;   -- query data
.mode box        -- nicer table output (optional)
.headers on      -- show column names

## Type the following in the same terminal to exit the SQLite Session:

.quit


