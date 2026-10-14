<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Customers place orders only via the `place_order` database function, which re-reads prices from `menu_items` — never trust browser prices.
- Owner-only data (orders, bank details, menu writes) is protected by RLS using `has_role(auth.uid(),'admin')`; the first account ever created becomes the owner.
- Owner panel lives at `/owner` (client-only); new orders are pushed live via realtime on `orders`.
