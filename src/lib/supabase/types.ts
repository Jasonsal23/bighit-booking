export type AppointmentStatus = "booked" | "completed" | "no_show" | "cancelled";
export type PaymentStatus = "unpaid" | "paid";
export type AppointmentSource = "online" | "manual";

export interface Shop {
  id: string;
  name: string;
  timezone: string;
  address: string | null;
}

export interface ShopHours {
  id: string;
  shop_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface BarberHours {
  id: string;
  barber_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface Barber {
  id: string;
  shop_id: string;
  name: string;
  photo_url: string | null;
  role: "barber" | "owner";
  active: boolean;
}

export interface Service {
  id: string;
  shop_id: string;
  barber_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  active: boolean;
}

export interface Customer {
  id: string;
  shop_id: string;
  name: string;
  phone: string;
  last_visit_at: string | null;
}

export interface Appointment {
  id: string;
  shop_id: string;
  barber_id: string;
  service_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  payment_status: PaymentStatus;
  source: AppointmentSource;
}

export interface Database {
  public: {
    Tables: {
      shops: { Row: Shop; Insert: Partial<Shop>; Update: Partial<Shop> };
      shop_hours: { Row: ShopHours; Insert: Partial<ShopHours>; Update: Partial<ShopHours> };
      barbers: { Row: Barber; Insert: Partial<Barber>; Update: Partial<Barber> };
      services: { Row: Service; Insert: Partial<Service>; Update: Partial<Service> };
      customers: { Row: Customer; Insert: Partial<Customer>; Update: Partial<Customer> };
      appointments: { Row: Appointment; Insert: Partial<Appointment>; Update: Partial<Appointment> };
    };
  };
}
