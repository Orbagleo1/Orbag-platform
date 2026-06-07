-- Capture the farmer's current certification on the profile so My Account can set it and the
-- farmer intake form (boer.html) can prefill it — closing the gap where the report referenced a
-- certification the user could not select anywhere in their profile (todo4 §G).
alter table public.profiles add column if not exists certification text;
