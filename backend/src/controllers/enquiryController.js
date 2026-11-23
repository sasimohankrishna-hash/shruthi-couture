const { ApiError } = require("../middleware/errorHandler");

function createEnquiryController(supabase) {
  async function create(req, res, next) {
    try {
      const record = {
        customer_name: req.body.customerName?.trim() || null,
        customer_phone: req.body.customerPhone?.trim() || null,
        customer_email: req.body.customerEmail?.trim() || null,
        message: req.body.message.trim(),
        status: "new",
      };

      const { data, error } = await supabase
        .from("enquiries")
        .insert(record)
        .select(
          "id,customer_name,customer_phone,customer_email,message,status",
        )
        .single();

      if (error) throw new ApiError(502, "Could not save enquiry");

      return res.status(201).json({
        success: true,
        message: "Enquiry submitted successfully",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  return { create };
}

module.exports = { createEnquiryController };
