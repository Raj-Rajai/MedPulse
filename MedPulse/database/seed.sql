-- ==========================================================
-- SEED DATA - Core Setup for Medical College & Students
-- No sample survey families or members
-- ==========================================================

-- Insert Default Medical Colleges
INSERT OR IGNORE INTO colleges (id, name, code, city, state)
VALUES (1, 'SAL Hospital', 'SAL-01', 'Ahmedabad', 'Gujarat');

INSERT OR IGNORE INTO colleges (id, name, code, city, state)
VALUES (2, 'SAL Institute of Medical Sciences', 'SAL-01', 'Ahmedabad', 'Gujarat');

-- Insert Default Demo Student (Roll 235, PIN 1234 - Dhruv Patel)
INSERT OR IGNORE INTO students (id, roll_number, name, pin, batch_year, college_id)
VALUES (1, '235', 'Dhruv Patel', '1234', '3rd Year MBBS (Community Medicine)', 1);
