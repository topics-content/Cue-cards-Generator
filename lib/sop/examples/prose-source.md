Tab 1
Lecture 3  —  Data Filtering with SQL
DSML  ·  Scaler 3.0  ·  120 min class  +  30 min doubts
Agenda  —  today's 120 minutes
Segment
	Time
	HOUR 1  —  Filtering
	60 min
	Instructor warm-up
	5 min
	Opening hook  —  10 million rows
	7 min
	Comparison operators  —  quick reference
	5 min
	WHERE clause
	12 min
	AND, OR, NOT
	10 min
	IN, BETWEEN
	8 min
	IS NULL  /  IS NOT NULL, NULL VS BLANK, TRIM
	8 min
	BREAK
	5 min
	HOUR 2  —  SQL Functions
	55 min
	What are SQL functions  —  one-minute intro
	3 min
	ROUND
	8 min
	CONCAT
	8 min
	UPPER  /  LOWER
	7 min
	LIKE  +  Wildcards
	12 min
	AI Segment  —  'debug my WHERE clause'
	12 min
	Practice preview
	5 min
	

Dataset: Zomato Dataset - Bigquery
________________
HOUR 1  —  Filtering
WHERE · AND/OR/NOT · IN · BETWEEN · IS NULL
Instructor Warm-up
5 min  ·  informal
Warm-up questions
Quick recap — 'From last class: what is the difference between LIMIT and OFFSET? '
'Who ran their first query on BigQuery this week? What did you try?'
Transition:  'Today we stop looking at all the data and start asking specific questions.'


It’s great to see so many of you running your first queries! But up until now, we’ve been looking at the whole table. Imagine you're at Zomato and you have 10 million rows of data in front of you. If your manager asks for one specific piece of information, you can't just scroll through it all. Today, we learn the art of the 'Search Box'—how to tell SQL exactly what to keep and what to ignore.
1.  Opening Hook  —  10 Million Rows
7 min
Make them feel the problem before teaching the solution.
Question to the class
Instructor:  Imagine you are a Zomato analyst. The orders table has 10 million rows. Your manager needs to know: how many orders failed in Bangalore, with an order value above ₹300?
Instructor:  Without filtering — what do you do? Open the table, scroll through 10 million rows?
Learner:  (laughter, 'that's impossible')
Instructor:  Exactly. Filtering is not an optional feature. It is the entire job. Every answer an analyst gives is a filtered view of the data. WHERE is how you do it.


  

Every question your manager asks has at least one condition in it. Sometimes five. Learning to translate those conditions into SQL is what separates an analyst from someone who just has data.
How every analyst question maps to a WHERE clause
'Failed payment orders'          →  WHERE payment_status = \'failed\'
'Orders above ₹300'              →  WHERE order_value > 300
'Bangalore customers'            →  WHERE city = \'Bangalore\'
'Orders that were never rated'   →  WHERE rating IS NULL
'Coupons with NEW in the code'   →  WHERE coupon_code LIKE \'NEW%\'
Today you learn all five of those translations.
A query without a WHERE clause is like a search engine with no search box. It returns everything  —  which is useless.
  

We know we need to filter, but to do that, we need a way to tell the database 'bigger than', 'smaller than', or 'exactly this. ' Luckily, you already know most of this language from school maths. Let’s quickly refresh those symbols so we can start building our first real conditions.
2.  Comparison Operators  —  Quick Reference
5 min
Before WHERE—you need to know what symbols you can use inside it.
Operator
	Meaning
	Zomato example
	=
	Equal to
	order_status = 'delivered'
	!=  or  <>
	Not equal to
	order_status != 'cancelled'
	>
	Greater than
	order_value > 500
	<
	Less than
	delivery_time_mins < 30
	>=
	Greater than or equal
	rating >= 4
	<=
	Less than or equal
	order_value <= 200
	

One thing to remember about text vs numbers:
Numbers: no quotes. WHERE order_value > 300
Text: always in single quotes. WHERE city = \'Bangalore\'
Common mistake: WHERE order_value > \'300\' — this compares text, not numbers. It may still run but gives wrong results.
  

Now that we have our symbols, let's put them to work. The WHERE clause is the heart of every analyst’s day. It’s the gatekeeper—only the rows that meet your rules get to pass through to your report. Let’s head into BigQuery and start pulling out only the orders we actually care about.
3.  WHERE Clause
12 min
The filter. Sits after 'FROM'. Only rows that pass the condition come through.
Instructor Note - Show this on screen: https://querycanvas-scaler-55oa.onrender.com/q/a2b4c6d8e0f13579
Business question
Instructor:  Show me all orders that were cancelled.


Type this with me  Open BigQuery. Type this:
Query 3.1  —  basic WHERE with text
SELECT  order_id,
        order_status,
        order_value
FROM    zomato.orders
WHERE   order_status = 'cancelled';
	Reads as:  Give me order ID, status, and value — but only for rows where order_status equals 'cancelled'.
Run it. Notice the result only shows cancelled orders. Every other status is filtered out.


Business question
Instructor:  Show me all orders where the order value is above ₹500.
Type this with me  Now with a number condition:
Query 3.2  —  WHERE with number comparison
SELECT  order_id,
        order_value,
        payment_method
FROM    zomato.orders
WHERE   order_value > 500;
	Reads as:  Give me orders where the value is greater than 500 rupees.


Business question
Instructor:  Show me orders with a rating of exactly 4.
Type this with me  Exact match on a number:
Query 3.3  —  WHERE with exact number
SELECT  order_id,
        rating,
        order_value
FROM    zomato.orders
WHERE   rating = 4;
	Reads as:  Only show rows where the rating column is exactly 4.
WHERE clause — how it works under the hood
The database reads every row in the table.
For each row, it checks: does this row pass the WHERE condition?
If yes — include it in the result.  If no — skip it.
This happens before any SELECT logic.  The filter runs first.
Order of execution:  FROM  →  WHERE  →  SELECT.  Not left to right as written.
WHERE runs before SELECT.  The filter happens before the database decides what to show you.
  

Filtering for one thing is easy, but business questions are usually more complex. Your manager won't just ask for 'cancelled orders'; they'll ask for 'cancelled orders above 500 rupees.' To answer that, we need to learn how to stack our conditions using AND, OR, and NOT.
4.  AND, OR, NOT
10 min
Multiple conditions. Most real analyst questions have more than one.
Instructor Note - Show this on screen: https://querycanvas-scaler-55oa.onrender.com/q/a2b4c6d8e0f13579
AND — both conditions must be true


Business question
Instructor:  Show me cancelled orders with a value above ₹500. Both conditions must be true.
Type this with me  Type this:
Query 4.1  —  AND
SELECT  order_id,
        order_status,
        order_value
FROM    zomato.orders
WHERE   order_status = 'cancelled'
  AND   order_value > 500;
	Reads as:  Only rows where BOTH: status is cancelled AND value is above 500.


OR — at least one condition must be true


Business question
Instructor:  Show me all orders paid by UPI or by Debit Card. Either one counts.
Type this with me  Type this:
Query 4.2  —  OR
SELECT  order_id,
        payment_method,
        order_value
FROM    zomato.orders
WHERE   payment_method = 'UPI'
   OR   payment_method = 'Debit Card';
	Reads as:  Rows where the payment method is UPI OR Debit Card — either one qualifies.


NOT — exclude rows that match


Business question
Instructor:  Show me all orders that are NOT cancelled.
Type this with me  Two ways to write it — both correct:
Query 4.3  —  NOT  (two equivalent ways)
-- Option 1: using NOT
SELECT  order_id,  order_status
FROM    zomato.orders
WHERE   NOT order_status = 'cancelled';
 
-- Option 2: using !=
SELECT  order_id,  order_status
FROM    zomato.orders
WHERE   order_status != 'cancelled';
	Reads as:  All orders where status is anything except cancelled.
  

AND vs OR — the one that trips everyone
AND makes results SMALLER. Both conditions must match. Fewer rows pass.
OR makes results LARGER. Either condition is enough. More rows pass.


Common mistake:  WHERE payment_method = \'UPI\' AND payment_method = \'Debit Card\'
This returns ZERO rows.  A single value cannot be UPI AND Debit Card at the same time.
Correct:  WHERE payment_method = \'UPI\' OR payment_method = \'Debit Card\'
Combining AND and OR — use brackets
Without brackets:  WHERE a = 1 OR b = 2 AND c = 3
SQL reads AND before OR  (like multiplication before addition in maths).
With brackets:  WHERE a = 1 OR (b = 2 AND c = 3)  — this is clear and correct.
Rule:  whenever you mix AND and OR, always add brackets.  Never rely on precedence.
As your conditions get longer, your code can start to look a bit messy. If you're checking for five different cities or a specific range of prices, typing OR over and over is exhausting. Let’s look at two brilliant shortcuts—IN and BETWEEN—that make your queries cleaner and much easier to read.
5.  IN  and  BETWEEN
8 min
Shortcuts that replace long OR chains. Cleaner, more readable.
Instructor Note - Show this on screen: https://querycanvas-scaler-55oa.onrender.com/q/a2b4c6d8e0f13579
IN — match any value in a list


Business question
Instructor:  Show me orders that are either in_transit or cancelled — not delivered. Without IN, how would you write this?
Learner:  (WHERE order_status = 'in_transit' OR order_status = 'cancelled')
Instructor:  Correct — but imagine 10 statuses. IN is the cleaner way.
Type this with me  Type this:
Query 5.1  —  IN
SELECT  order_id,
        order_status,
        order_value
FROM    zomato.orders
WHERE   order_status IN ('in_transit', 'cancelled');
	Reads as:  Show orders where status is either 'in_transit' or 'cancelled' — any value from that list.
NOT IN — exclude any value in a list


Business question
Instructor:  Show me orders that are NOT in_transit or cancelled — only delivered. Without NOT IN, how would you write this?
Learner:  (WHERE order_status != 'in_transit' OR order_status != 'cancelled')
Instructor:  Correct — but imagine 10 statuses. NOT IN is the cleaner way.
Type this with me  Type this:
Query 5.1  —  IN
SELECT  order_id,
        order_status,
        order_value
FROM    zomato.orders
WHERE   order_status NOT IN ('in_transit', 'cancelled');
	Reads as:  Show orders where status is neither 'in_transit' nor 'cancelled' — exclude any value from that list.
  

BETWEEN — match a range of values


Business question
Instructor:  Show me orders where the value is between ₹200 and ₹500.
Type this with me  Type this:
Query 5.2  —  BETWEEN
SELECT  order_id,
        order_value
FROM    zomato.orders
WHERE   order_value BETWEEN 200 AND 500;
	Reads as:  Show orders where order_value is anywhere from 200 to 500 — both ends included.
Type this with me  BETWEEN works on dates too — you'll use this in Lecture 18:
Query 5.3  —  BETWEEN on dates  (preview)
SELECT  order_id,
        order_date
FROM    zomato.orders
WHERE   order_date BETWEEN '2025-04-01' AND '2025-06-30';
	Reads as:  All orders placed in Q1 2025 — April through June, both dates included.
Instructor cue  don't deep-dive dates now — just show the syntax and say 'this is why DATE type matters, we cover date functions properly in Lecture 18.'
BETWEEN is always inclusive
BETWEEN 200 AND 500  includes  200, 340, 499, 500.
It does NOT include 199 or 501.
Equivalent to:  WHERE order_value >= 200 AND order_value <= 500
Both are correct.  BETWEEN is just shorter.
We've learned how to filter for values we see, but what about the data that’s missing? In the real world, customers often skip the rating screen, leaving a 'hole' in our data called NULL. This is the biggest trap for new analysts, so let’s learn the only correct way to find those missing pieces.
6.  IS NULL  /  IS NOT NULL, NULL VS BLANK, TRIM
8 min
The filter that catches missing data. One of the most important things in real-world SQL.
Instructor Note - Show this on screen: https://querycanvas-scaler-55oa.onrender.com/q/f1d4a7e0b3c68259
Question to the class
Instructor:  In the orders table, the rating column is NULL for some orders. What does NULL mean?
Learner:  (the customer didn't rate, or zero?)
Instructor:  Not zero. NULL means the value was never recorded. The customer placed the order, got it delivered, and never left a rating. That row exists — but the rating is empty. Now — how do we find all orders where no rating was given?
Learner:  (WHERE rating = NULL?)
Instructor:  Logical guess — but wrong. This is the biggest NULL trap in SQL. Watch.
Type this with me  Try this first — the wrong way:
Query 6.1  —  wrong way to check NULL  (never do this)
SELECT  order_id,  rating
FROM    zomato.orders
WHERE   rating = NULL;    -- returns 0 rows, always
	Run it. Zero rows. Why? Because NULL = NULL is not TRUE in SQL. NULL means unknown. An unknown value cannot be equal to anything — not even another unknown value.


Type this with me  The correct way — IS NULL:
Query 6.2  —  IS NULL
SELECT  order_id,
        order_status,
        rating
FROM    zomato.orders
WHERE   rating IS NULL;
	Reads as:  Show me all orders where no rating was recorded.
Run it. Now you see all the unrated orders.


Business question
Instructor:  Show me only orders that have been rated — where a rating exists.
Type this with me  Flip it with IS NOT NULL:
Query 6.3  —  IS NOT NULL
SELECT  order_id,
        rating,
        order_value
FROM    zomato.orders
WHERE   rating IS NOT NULL
ORDER BY  rating  DESC;
	Reads as:  Show me orders where a rating was given — highest rating first.
BLANK VALUES — empty strings are different from NULL
Question to the class
Instructor:  If a coupon_code column contains '' (an empty string), is that the same as NULL?
Learner:  (pause for answers)
Instructor:  No. NULL means the value was never recorded. A blank string means a value exists, but it is empty.
Type this with me  filter blank values
Query 6.3A  —  Filter blank values
SELECT order_id,
coupon_code
FROM zomato.orders
WHERE coupon_code = '';
	Instructor cue  Don't display the above query on the BigQuery platform. Here, the above query ‘filter blank values’ will not display any data on bigquery, as our dataset does not contain blank string values.
Reads as: Show all orders where the coupon_code exists but was stored as an empty string.


Important
NULL and '' (blank string) are different.
WHERE coupon_code IS NULL → missing value
WHERE coupon_code = '' → blank value
In real datasets, you often need to check for both.


Type this with me  Combine with other filters — show high-value orders with no coupon applied:
Query 6.4  —  IS NULL combined with AND
SELECT  order_id,
        order_value,
        coupon_code
FROM    zomato.orders
WHERE   coupon_code IS NULL
  AND   order_value > 400;
	Reads as:  High-value orders where no coupon was used — full-price customers.
NULL rules — pin these
NULL is not zero.  NULL is not an empty string.  NULL is the absence of a value.
NULL = NULL is FALSE.  You cannot compare NULL with =
IS NULL and IS NOT NULL are the only correct ways to check for missing values.
If you write WHERE rating = NULL in an interview — you will be corrected.
NULL is not a value.  It is the absence of one.  IS NULL and IS NOT NULL are the only correct filters.
NULL VS BLANK  and  TRIM


Instructor Note - Show this on screen: Ignore 3/4 from link - 1 https://querycanvas-scaler-55oa.onrender.com/q/2a6d9f3c8b1e5047
  

* If someone asked you to find all coupon_code that didn't have values, you might also want to check for blank strings, which would equal "", or rows where someone entered a space or any number of spaces into that field.
* The TRIM() function removes excess spaces from the beginning or end of a string value, so if you use a combination of the TRIM() function and blank string comparison, you can find any row that is blank or contains only spaces.
Note: Keep in mind that "blank" and NULL are not the same thing in database terms.
Question: Find all orders where the coupon_code is either missing (NULL) or entered as blank or spaces.
Query 6.5  —  NULL VS BLANK & TRIM in single query
SELECT  order_id,
        order_value,
        coupon_code
FROM    zomato.orders
WHERE   coupon_code IS NULL
   OR   TRIM(coupon_code) = '';
	Reads as:  Show all orders where no coupon was applied — either the coupon field was never filled in, or it was entered as blank or spaces. 
  

Instructor cue  You will see TRIM() concept in detail in Lec- 4, pls check understand the above query, such that you understand the null vs blank logic using trim.
  

  

Instructor cue  close Hour 1 with  —  'Every query in real work involves at least one filter. You now have the full toolkit. After the break — functions. A different kind of power.'
You now have the power to filter 10 million rows down to the exact ten that matter. That is 70% of the job right there! Take 5 minutes to stretch and grab a coffee. When we come back, we’re going to learn how to transform the data we found—rounding numbers, joining text, and cleaning up messy entries on the fly.
________________


HOUR 2  —  SQL Functions
ROUND · CONCAT · UPPER/LOWER · LIKE/Wildcards
You now have the power to filter 10 million rows down to the exact ten that matter. That is 70% of the job right there! Take 5 minutes to stretch and grab a coffee. When we come back, we’re going to learn how to transform the data we found—rounding numbers, joining text, and cleaning up messy entries on the fly.
Functions  —  One-Minute Intro
3 min
You know how Excel has functions like =ROUND() and =UPPER()? SQL has the same — but they run on millions of rows at once.
What a SQL function does
Takes a column value as input.
Does something to it  —  rounds it, formats it, cleans it.
Returns the transformed value in your result.
Runs on every row automatically.  No loops.  No scripts.
Syntax:  FUNCTION_NAME(column_name)  or  FUNCTION_NAME(column_name, argument)


  

  

Think of SQL functions like the 'tools' in your kitchen. Our first tool is one you’ve definitely used in Excel: ROUND. When we calculate things like discount percentages, we often get long, ugly decimals. Let's learn how to trim those down so our reports look clean and professional.
7.  ROUND
8 min
Rounds a number to a specified number of decimal places.
Instructor Note - Show this on screen: Only explain 0/3 simulation to the learners.
https://querycanvas-scaler-55oa.onrender.com/q/c5a8e1b4f7d03629
Business question
Instructor:  Calculate the discount percentage for each order — but round it to 1 decimal place. No one wants to read 23.876543%.
Type this with me  Type this:
Query 7.1  —  ROUND
SELECT  order_id,
        order_value,
        discount_amount,
        ROUND((discount_amount / order_value) * 100, 1)  AS  discount_pct
FROM    zomato.orders
WHERE   discount_amount > 0
LIMIT   10;
	Reads as:  Calculate discount as a percentage of order value, rounded to 1 decimal place — for orders where a discount was applied.
Type this with me  ROUND to 0 decimal places — whole numbers only:
Query 7.2  —  ROUND to whole number
SELECT  order_id,
        order_value,
        ROUND(order_value, 0)  AS  value_rounded
FROM    zomato.orders
LIMIT   10;
	Reads as:  Show order value rounded to the nearest whole rupee.
ROUND syntax
ROUND(value, decimal_places)
ROUND(23.876, 1)   →  23.9
ROUND(23.876, 0)   →  24
ROUND(23.876, 2)   →  23.88
The second argument is optional.  ROUND(value)  defaults to 0 decimal places.
Numbers are only half the story. Sometimes, you need to combine text from different columns to create a readable label, like putting an Order ID right next to its Status. We use CONCAT for this—it’s like the glue that lets us build custom text for our reports.
8.  CONCAT
8 min
Joins text from multiple columns into a single string. Useful for labels, display fields, and building readable identifiers.
Instructor Note - Show this on screen: https://querycanvas-scaler-55oa.onrender.com/q/b1e4a7c0d3f68925
Business question
Instructor:  Our reporting team wants a single column that shows 'ORD001 - delivered' for each order — the order ID followed by its status. How do we build that?
Type this with me  Type this:
Query 8.1  —  CONCAT two columns
SELECT  order_id,
        order_status,
        CONCAT(order_id, ' - ', order_status)  AS  order_label
FROM    zomato.orders
LIMIT   10;
	Reads as:  Create a new column that combines order_id, a dash, and the status — all in one string.
  

Type this with me  CONCAT works with any text — mix columns and fixed strings:
Query 8.2  —  CONCAT with descriptive text
SELECT  order_id,
        order_value,
        CONCAT('Order value: ₹', order_value)  AS  value_label
FROM    zomato.orders
LIMIT   10;
	Reads as:  Prefix each order value with 'Order value: ₹' to make a readable label.
CONCAT rules
CONCAT(col1, separator, col2)  —  separate arguments with commas.
Fixed text must be in single quotes:  CONCAT(order_id, \' - \', order_status)
If any argument is NULL, the entire CONCAT result becomes NULL in MySQL.
BigQuery alternative:  you can also use  ||  operator:  order_id || \' - \' || order_status
One of the biggest headaches for an analyst is 'dirty' data—where one person types 'Delivered' and another types 'delivered.' To a computer, those are different! Let’s look at how UPPER and LOWER can save your life by making all your text look the same before you even try to filter it.
9.  UPPER  /  LOWER
7 min
Converts text to all uppercase or all lowercase. Essential for data cleaning and consistent filtering.
Instructor Note - Show this on screen: https://querycanvas-scaler-55oa.onrender.com/q/b1e4a7c0d3f68925
Business question
Instructor:  Our data has order statuses stored as 'delivered', 'Delivered', 'DELIVERED' — all three exist due to bad data entry. How do we filter consistently?
Learner:  (use LOWER to normalize?)
Instructor:  Exactly. Convert everything to the same case before comparing.
Type this with me  Type this:
Query 9.1  —  LOWER for consistent filtering
SELECT  order_id,
        order_status,
        LOWER(order_status)  AS  status_clean
FROM    zomato.orders
WHERE   LOWER(order_status) = 'delivered'
LIMIT   10;
	Reads as:  Show delivered orders — converting status to lowercase before comparing, so 'Delivered' and 'DELIVERED' both match.
  

Type this with me  UPPER works the same way — useful for display labels:
Query 9.2  —  UPPER for display
SELECT  order_id,
        UPPER(payment_method)   AS  payment_display,
        LOWER(order_status)     AS  status_display
FROM    zomato.orders
LIMIT   10;
	Reads as:  Show payment method in uppercase, order status in lowercase — clean display formatting.
When to use UPPER / LOWER
Data cleaning:  normalize columns before comparison to catch inconsistent casing.
Rule:  when in doubt about casing in a WHERE filter — wrap with LOWER() or UPPER() on both sides.
What happens if you don't know the exact word you're looking for? Maybe you only know that a coupon code starts with 'NEW' or contains the word 'USER'. This is where we use LIKE and 'Wildcards'—it’s essentially the 'Search Bar' of SQL that lets us match patterns instead of just exact words.
10.  LIKE  +  Wildcards
12 min
Pattern matching. The search bar of SQL. For when you don't know the exact value — just part of it.
Instructor Note - Show this on screen: Only explain 5/6 to the learners. https://querycanvas-scaler-55oa.onrender.com/q/a2b4c6d8e0f13579
Question to the class
Instructor:  In the orders table, coupon codes include NEWUSER50, NEWUSER30, NEWUSER10 — all start with 'NEW'. How do we filter all of them at once without knowing every exact code?
Learner:  (some kind of wildcard?)
Instructor:  Exactly. LIKE with a wildcard. Two wildcards to know: % and _
The two wildcards
%  =  matches any sequence of characters  (including none)
_  =  matches exactly one character


'NEW%'  →  matches NEWUSER50, NEW30, NEWITEM  (anything starting with NEW)
'%30'   →  matches NEWUSER30, FESTIVE30, SALE30  (anything ending with 30)
'%USER%' →  matches NEWUSER50, OLDUSER10  (anything containing USER)
'NEW___' →  matches NEW123, NEWABC  (NEW followed by exactly 3 characters)


Type this with me  Start with % at the end — things that START with a pattern:
Query 10.1  —  LIKE with % (starts with)
SELECT  order_id,
        coupon_code,
        discount_amount
FROM    zomato.orders
WHERE   coupon_code LIKE 'NEW%';
	Reads as:  Show all orders where the coupon code starts with 'NEW' — regardless of what follows.


Type this with me  % at the start — things that END with a pattern:
Query 10.2  —  LIKE with % (ends with)
SELECT  order_id,
        coupon_code
FROM    zomato.orders
WHERE   coupon_code LIKE '%50';
	Reads as:  Show orders where the coupon code ends with '50' — NEWUSER50, FESTIVE50, etc.


Type this with me  % on both sides — things that CONTAIN a pattern:
Query 10.3  —  LIKE with % (contains)
SELECT  order_id,
        coupon_code
FROM    zomato.orders
WHERE   coupon_code LIKE '%USER%';
	Reads as:  Show orders where the coupon code contains 'USER' anywhere in it.


Type this with me  Combine LIKE with other filters — real analyst query:
Query 10.4  —  LIKE combined with WHERE filters
SELECT  order_id,
        coupon_code,
        discount_amount,
        order_value
FROM    zomato.orders
WHERE   coupon_code LIKE 'NEW%'
  AND   order_value > 300
ORDER BY  discount_amount  DESC;
	Reads as:  Show orders where a NEW coupon was used, order value is above 300, sorted by highest discount first.
Type this with me  NOT LIKE — exclude a pattern:
Query 10.5  —  NOT LIKE
SELECT  order_id,
        coupon_code
FROM    zomato.orders
WHERE   coupon_code IS NOT NULL
  AND   coupon_code NOT LIKE 'NEW%';
	Reads as:  Orders that used a coupon — but not a NEW coupon.
  



Pattern
	Matches
	Does NOT match
	LIKE 'NEW%'
	NEWUSER50, NEWCUST, NEW30
	FESTIVE30, SALE50
	LIKE '%30'
	NEWUSER30, FESTIVE30
	NEWUSER50, NEW
	LIKE '%USER%'
	NEWUSER50, OLDUSER10
	FESTIVE30, NEW30
	LIKE 'NEW___'
	NEW123, NEWABC
	NEWUSER50  (too long)
	LIKE performance note — for senior-track learners
Index: A database object that stores column values in a sorted structure to help SQL find matching rows quickly without scanning the entire table.
LIKE \'%value%\' is slow on large tables — It usually cannot use indexes efficiently.
LIKE \'value%\' (prefix match) is fast — it can use indexes.
In production with millions of rows, avoid leading % patterns if performance matters.
For analytics on a DW like BigQuery — less of a concern.  Still good to know.
% matches anything.  _ matches one character.  LIKE is how you search when you only know part of the value.
  



Even pros make mistakes" is generic and doesn't tie the AI segment back to anything from today's content. Should reference a specific topic: "You've now written WHERE clauses with five different tools. Let's take a buggy query using all of them and see if AI can spot what's wrong before you do.
11.  AI Segment  —  Debug My WHERE Clause
12 min
Shape: learner writes a query with a deliberate mistake. AI is asked to find the bug. Class evaluates whether AI found the right issue.
What we're doing
Step 1  —  Instructor writes a buggy WHERE clause on screen  (one of the common mistakes from today).
Step 2  —  Ask Claude or ChatGPT to review it and find the problem.
Step 3  —  Class discusses:  did AI correctly identify the bug?  Did it explain why?
Step 4  —  Fix the query live.  Run the corrected version.


Step 1  —  show this buggy query on screen
Instructor:  Here is a query a junior analyst wrote. Find the bug before we ask AI.
Buggy query — what is wrong here?
SELECT  order_id,  rating,  coupon_code
FROM    zomato.orders
WHERE   rating = NULL
  AND   payment_method = 'UPI' AND payment_method = 'Debit Card'
  AND   order_value BETWEEN '200' AND '500';
	There are three bugs. Ask the class to spot them first. Then paste into Claude.
The three bugs — reveal after class discussion
Bug 1:  rating = NULL  should be  rating IS NULL.  = NULL always returns 0 rows.
Bug 2:  payment_method = \'UPI\' AND payment_method = \'Debit Card\'  should be OR not AND.
        A single row cannot have two different payment methods simultaneously.
Bug 3:  BETWEEN \'200\' AND \'500\'  —  number in quotes makes this a text comparison.
        Should be  BETWEEN 200 AND 500  (no quotes).


  

Instructor cue  paste the buggy query into Claude with the message: 'This query returns no results. What is wrong?' Let AI explain. Then check: did it catch all three bugs? Did it explain the NULL issue correctly? Did it understand the AND vs OR issue? Discuss what it got right and what it missed.
What AI usually gets right vs misses on this query
Usually catches:  the NULL comparison mistake  —  AI knows this is a well-known SQL trap.
Sometimes misses:  the AND vs OR logic bug  —  AI may not flag this if it cannot see your data.
Usually catches:  quotes around numbers in BETWEEN  —  though may explain it unclearly.
The point:  AI is a strong syntax checker.  It is weaker on business logic errors.
AI finds syntax bugs well.  Business logic bugs  —  only you know the data well enough to spot those.


We've covered a lot of ground today—from basic filters to complex pattern matching. But SQL is a muscle; you have to train it. Before we wrap up, let’s walk through the practice problems I’ve set for you, so you can start flexing those new filtering skills on the Zomato data.
12.  Practice Preview  —  Before Next Class
5 min
Three tiers. Every query uses only the zomato.orders or zomato.customers table.
Beginner  —  single condition filters
Beginner practice
1.  Show all orders where payment failed.  Columns:  order_id, payment_status, order_value.
2.  Show all customers from Delhi.  Columns:  customer_id, city, is_prime.
3.  Show all orders with a delivery time longer than 60 minutes.
4.  Show all orders where no coupon was applied  (coupon_code is NULL).
5.  Show all orders with a rating of 1 or 2  —  the worst-rated orders.


Intermediate  —  multiple conditions + functions
Intermediate practice
1.  Show all UPI orders above ₹400 that were delivered.  Sort by order value, highest first.
2.  Find all orders where a coupon starting with 'FESTIVE' was used.  Show the discount amount and order value.
3.  Show all customers who are Prime members  (is_prime = \'Y\').  Display their city in uppercase.
4.  Show orders with a discount percentage above 20%.  Calculate it as  ROUND((discount_amount / order_value) * 100, 1)  and label the column  discount_pct.
Filtering is 70% of analyst work.  Master WHERE and you master most of the job.


Concepts covered today  —  quick reference
Concept
	What it does
	Syntax
	Comparison operators
	Compare values in a condition
	=  !=  >  <  >=  <=
	WHERE
	Filter rows by a condition
	WHERE col = value
	AND
	Both conditions must be true
	WHERE a = 1 AND b = 2
	OR
	Either condition is enough
	WHERE a = 1 OR a = 2
	NOT
	Exclude matching rows
	WHERE NOT col = value
	IN
	Match any value from a list
	WHERE col IN ('a','b')
	BETWEEN
	Match a range  (both ends included)
	WHERE col BETWEEN 200 AND 500
	IS NULL
	Find rows with no value
	WHERE col IS NULL
	IS NOT NULL
	Find rows that have a value
	WHERE col IS NOT NULL
	ROUND
	Round a number
	ROUND(col, 1)
	CONCAT
	Join text from multiple columns
	CONCAT(col1, ' - ', col2)
	UPPER / LOWER
	Change text case
	UPPER(col)  /  LOWER(col)
	LIKE
	Pattern match on text
	WHERE col LIKE 'NEW%'
	%  wildcard
	Any sequence of characters
	LIKE '%USER%'
	_  wildcard
	Exactly one character
	LIKE 'NEW___'
	





Tab 2
Based on the curriculum for Lecture 3 — Data Filtering with SQL, here are the quiz questions for the specified sections.
________________


1. Comparison Operators
Question: When filtering text-based data, such as a city name, what is the correct syntax to use in a WHERE clause?
* (A) WHERE city = Bangalore
* (B) WHERE city = 'Bangalore'
* (C) WHERE city == 'Bangalore'
* (D) WHERE city = -Bangalore-
Correct Answer: (B)
Explanation: In SQL, text values must always be enclosed in single quotes. Additionally, SQL uses a single = for comparison, unlike some programming languages that use ==.
________________


2. WHERE Clause
Question: Although we write the SELECT statement at the top of our query, in what order does the database actually execute these commands?
* (A) SELECT → FROM → WHERE
* (B) FROM → SELECT → WHERE
* (C) FROM → WHERE → SELECT
* (D) WHERE → FROM → SELECT
Correct Answer: (C)
Explanation: The database first identifies the table (FROM), then applies the filters to the rows (WHERE), and finally decides which specific columns to display (SELECT).
________________


3. AND, OR, NOT
Question: A junior analyst runs the query: WHERE payment_method = 'UPI' AND payment_method = 'Debit Card'. This query returns zero rows because:
* (A) The database does not support both payment methods.
* (B) The AND operator is only used for numbers, not text.
* (C) A single row (order) cannot have two different values in the same column at the same time.
* (D) The payment_method column must be written in lowercase.
Correct Answer: (C)
Explanation: The AND operator requires both conditions to be true for a single record. Since an order can only have one payment method, it cannot be both 'UPI' and 'Debit Card' simultaneously; OR should be used instead.
________________


4. IS NULL / IS NOT NULL
Question: If you want to find orders that have not yet been rated by a customer, which of the following is the only correct way to check for those missing values?
* (A) WHERE rating = NULL
* (B) WHERE rating IS NULL
* (C) WHERE rating == NULL
* (D) WHERE rating = 0
Correct Answer: (B)
Explanation: In SQL, NULL represents the absence of data, and you cannot use the = operator to find it. IS NULL is the specific operator designed to identify missing or unrecorded values.
________________


5. LIKE + Wildcards
Question: Which of the following LIKE patterns would correctly filter values that start with 'NEW', such as 'NEWUSER50', while excluding values like 'FESTIVE50'?
(A) LIKE '%50'
(B) LIKE 'NEW%'
(C) LIKE '%USER%'
(D) LIKE '_50'
Correct Answer: (B)
Explanation: The pattern NEW% matches any string that begins with "NEW". Since 'NEWUSER50' starts with "NEW", it is included, while 'FESTIVE50' does not start with "NEW", so it is excluded.