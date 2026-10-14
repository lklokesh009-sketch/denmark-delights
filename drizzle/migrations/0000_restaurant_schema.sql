CREATE TYPE public.app_role AS ENUM ('admin');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- First account ever created becomes the owner
CREATE OR REPLACE FUNCTION public.assign_first_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created_owner AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_first_owner();

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  description text,
  available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read menu" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner writes menu" ON public.menu_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.restaurant_info (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name text NOT NULL DEFAULT 'DENMARK RESTAURANT',
  tagline text NOT NULL DEFAULT 'Authentic Chinese & Arabian non-veg cuisine',
  address text NOT NULL DEFAULT 'Tamil Nadu, India',
  phone text NOT NULL DEFAULT '+91 00000 00000',
  hours text NOT NULL DEFAULT '11:00 AM – 11:00 PM, all days'
);
GRANT SELECT ON public.restaurant_info TO anon, authenticated;
GRANT UPDATE ON public.restaurant_info TO authenticated;
GRANT ALL ON public.restaurant_info TO service_role;
ALTER TABLE public.restaurant_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read info" ON public.restaurant_info FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "owner updates info" ON public.restaurant_info FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.restaurant_info (id) VALUES (1);

CREATE TABLE public.owner_payment_details (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  account_holder text, bank_name text, account_number text, ifsc text, upi_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.owner_payment_details TO authenticated;
GRANT ALL ON public.owner_payment_details TO service_role;
ALTER TABLE public.owner_payment_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner only bank" ON public.owner_payment_details FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.owner_payment_details (id) VALUES (1);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number serial,
  customer_name text NOT NULL,
  phone text NOT NULL,
  address text,
  order_type text NOT NULL CHECK (order_type IN ('dine_in','delivery')),
  payment_method text NOT NULL CHECK (payment_method IN ('credit_card','debit_card','net_banking','upi','cash')),
  items jsonb NOT NULL,
  total numeric(10,2) NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','preparing','ready','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner updates orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner deletes orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Customers place orders through this function; prices are taken from the menu, never from the browser
CREATE OR REPLACE FUNCTION public.place_order(
  _customer_name text, _phone text, _address text, _order_type text, _payment_method text, _notes text, _items jsonb)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  line jsonb; m record; q int; tot numeric := 0; out_items jsonb := '[]'::jsonb; num int;
BEGIN
  IF coalesce(trim(_customer_name),'') = '' OR coalesce(trim(_phone),'') = '' THEN RAISE EXCEPTION 'Name and phone are required'; END IF;
  IF _order_type = 'delivery' AND coalesce(trim(_address),'') = '' THEN RAISE EXCEPTION 'Address is required for delivery'; END IF;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  FOR line IN SELECT * FROM jsonb_array_elements(_items) LOOP
    q := (line->>'qty')::int;
    IF q IS NULL OR q < 1 OR q > 50 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT id, name, price INTO m FROM public.menu_items WHERE id = (line->>'id')::uuid AND available;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item is no longer available'; END IF;
    tot := tot + m.price * q;
    out_items := out_items || jsonb_build_object('id', m.id, 'name', m.name, 'price', m.price, 'qty', q);
  END LOOP;
  INSERT INTO public.orders (customer_name, phone, address, order_type, payment_method, notes, items, total)
  VALUES (left(_customer_name,100), left(_phone,20), left(_address,500), _order_type, _payment_method, left(_notes,500), out_items, tot)
  RETURNING order_number INTO num;
  RETURN num;
END $$;
GRANT EXECUTE ON FUNCTION public.place_order(text,text,text,text,text,text,jsonb) TO anon, authenticated;

INSERT INTO public.menu_items (name, category, price, sort_order) VALUES
('Chilli Chicken','Chinese Starters',220,1), ('Dragon Chicken','Chinese Starters',240,2), ('Chicken 65','Chinese Starters',200,3), ('Chicken Lollipop','Chinese Starters',230,4), ('Honey Chilli Chicken','Chinese Starters',250,5), ('Pepper Chicken Dry','Chinese Starters',240,6), ('Garlic Chicken','Chinese Starters',230,7), ('Crispy Fried Prawns','Chinese Starters',320,8), ('Chilli Prawns','Chinese Starters',330,9), ('Golden Fried Fish','Chinese Starters',280,10), ('Chilli Fish','Chinese Starters',290,11), ('Szechuan Chicken','Chinese Starters',250,12), ('Manchurian Chicken','Chinese Starters',230,13), ('Chicken Sweet Corn Soup','Chinese Soups',140,14), ('Hot & Sour Chicken Soup','Chinese Soups',150,15), ('Chicken Manchow Soup','Chinese Soups',150,16), ('Seafood Clear Soup','Chinese Soups',180,17), ('Lemon Coriander Chicken Soup','Chinese Soups',150,18), ('Chicken Fried Rice','Noodles & Fried Rice',200,19), ('Egg Fried Rice','Noodles & Fried Rice',170,20), ('Mixed Fried Rice','Noodles & Fried Rice',260,21), ('Szechuan Chicken Fried Rice','Noodles & Fried Rice',230,22), ('Prawn Fried Rice','Noodles & Fried Rice',280,23), ('Chicken Hakka Noodles','Noodles & Fried Rice',210,24), ('Egg Noodles','Noodles & Fried Rice',180,25), ('Mixed Noodles','Noodles & Fried Rice',270,26), ('Szechuan Chicken Noodles','Noodles & Fried Rice',230,27), ('Chicken Triple Szechuan Rice','Noodles & Fried Rice',290,28), ('American Chopsuey Chicken','Noodles & Fried Rice',260,29), ('Burnt Garlic Chicken Rice','Noodles & Fried Rice',240,30), ('Al Faham Full','Arabian Grills',520,31), ('Al Faham Half','Arabian Grills',280,32), ('Al Faham Quarter','Arabian Grills',160,33), ('Peri Peri Grill Full','Arabian Grills',560,34), ('Peri Peri Grill Half','Arabian Grills',300,35), ('Charcoal Grill Chicken Full','Arabian Grills',500,36), ('Chicken Shish Tawook','Arabian Grills',320,37), ('Mutton Seekh Kebab','Arabian Grills',380,38), ('Chicken Seekh Kebab','Arabian Grills',300,39), ('Lamb Chops','Arabian Grills',560,40), ('Mixed Grill Platter','Arabian Grills',890,41), ('Hammour Fish Grill','Arabian Grills',620,42), ('Chicken Shawarma Roll','Shawarma & Rolls',120,43), ('Chicken Shawarma Plate','Shawarma & Rolls',220,44), ('Mexican Shawarma','Shawarma & Rolls',150,45), ('Spicy Shawarma','Shawarma & Rolls',140,46), ('Cheese Shawarma','Shawarma & Rolls',160,47), ('Mutton Shawarma Roll','Shawarma & Rolls',170,48), ('Chicken Kubbus Roll','Shawarma & Rolls',130,49), ('Falafel Chicken Wrap','Shawarma & Rolls',150,50), ('Chicken Mandi Single','Mandi & Kabsa',320,51), ('Chicken Mandi Family','Mandi & Kabsa',1100,52), ('Mutton Mandi Single','Mandi & Kabsa',450,53), ('Mutton Mandi Family','Mandi & Kabsa',1600,54), ('Chicken Kabsa','Mandi & Kabsa',330,55), ('Mutton Kabsa','Mandi & Kabsa',470,56), ('Fish Mandi','Mandi & Kabsa',420,57), ('Alfaham Mandi','Mandi & Kabsa',380,58), ('Zurbian Chicken Rice','Mandi & Kabsa',350,59), ('Ambur Chicken Biryani','Biryani',220,60), ('Ambur Mutton Biryani','Biryani',320,61), ('Dindigul Chicken Biryani','Biryani',230,62), ('Dindigul Mutton Biryani','Biryani',330,63), ('Chicken 65 Biryani','Biryani',250,64), ('Egg Biryani','Biryani',160,65), ('Prawn Biryani','Biryani',320,66), ('Fish Biryani','Biryani',300,67), ('Hyderabadi Chicken Dum Biryani','Biryani',260,68), ('Arabian Chicken Biryani','Biryani',270,69), ('Bucket Biryani (Family)','Biryani',990,70), ('Chettinad Chicken Gravy','Tamil Nadu Specials',240,71), ('Chettinad Mutton Chukka','Tamil Nadu Specials',330,72), ('Pepper Mutton Fry','Tamil Nadu Specials',340,73), ('Nattu Kozhi Kuzhambu','Tamil Nadu Specials',320,74), ('Kola Urundai','Tamil Nadu Specials',220,75), ('Mutton Bone Soup','Tamil Nadu Specials',150,76), ('Kothu Parotta Chicken','Tamil Nadu Specials',180,77), ('Kothu Parotta Mutton','Tamil Nadu Specials',230,78), ('Nethili Fry','Tamil Nadu Specials',220,79), ('Vanjaram Fish Fry','Tamil Nadu Specials',380,80), ('Crab Masala','Tamil Nadu Specials',420,81), ('Egg Kalakki','Tamil Nadu Specials',60,82), ('Kubbus','Breads',20,83), ('Parotta','Breads',25,84), ('Butter Naan','Breads',50,85), ('Garlic Naan','Breads',60,86), ('Tandoori Roti','Breads',30,87), ('Fresh Lime Soda','Beverages',70,88), ('Mint Lemonade','Beverages',90,89), ('Arabian Mojito','Beverages',120,90), ('Avocado Shake','Beverages',150,91), ('Sulaimani Tea','Beverages',40,92), ('Rose Milk','Beverages',80,93), ('Falooda','Beverages',160,94), ('Kunafa','Desserts',220,95), ('Umm Ali','Desserts',180,96), ('Baklava (4 pcs)','Desserts',200,97), ('Caramel Pudding','Desserts',120,98), ('Gulab Jamun','Desserts',90,99), ('Arabian Date Pudding','Desserts',160,100);