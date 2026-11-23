const { ApiError } = require("../middleware/errorHandler");

function createAdminController(supabase, createAuthenticatedSupabaseClient) {
  async function verifyAdmin(req) {
    const userSupabase = createAuthenticatedSupabaseClient(
      req.auth.accessToken,
    );
    const { data, error } = await userSupabase.rpc("is_admin");

    if (error) {
      throw new ApiError(502, "Could not verify administrator access");
    }
    if (data !== true) {
      throw new ApiError(403, "Administrator access required");
    }
  }

  async function getSession(req, res, next) {
    try {
      await verifyAdmin(req);
      return res.json({
        success: true,
        message: "Administrator session verified",
        data: {
          isAdmin: true,
          email: req.auth.user.email || null,
        },
      });
    } catch (error) {
      return next(error);
    }
  }

  async function listOrders(req, res, next) {
    try {
      await verifyAdmin(req);

      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(
          "id,customer_name,customer_phone,total_amount,stock_deducted",
        )
        .order("id", { ascending: false });

      if (ordersError) {
        throw new ApiError(502, "Could not retrieve orders");
      }

      const orderIds = (orders || []).map((order) => order.id);
      if (orderIds.length === 0) {
        return res.json({
          success: true,
          message: "Orders retrieved successfully",
          data: [],
        });
      }

      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select(
          "id,order_id,product_id,variant_id,product_name,selected_size,selected_color,quantity,product_price,line_total",
        )
        .in("order_id", orderIds);

      if (itemsError) {
        throw new ApiError(502, "Could not retrieve order items");
      }

      const itemsByOrder = new Map(orderIds.map((id) => [id, []]));
      for (const item of items || []) {
        itemsByOrder.get(item.order_id)?.push(item);
      }

      return res.json({
        success: true,
        message: "Orders retrieved successfully",
        data: (orders || []).map((order) => ({
          ...order,
          items: itemsByOrder.get(order.id),
        })),
      });
    } catch (error) {
      return next(error);
    }
  }

  return { getSession, listOrders };
}

module.exports = { createAdminController };
