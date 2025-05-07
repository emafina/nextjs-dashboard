'use server';

import { z } from 'zod';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import postgres from 'postgres';
const sql = postgres(process.env.POSTGRES_URL!,{ssl:'require'});

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string({
        invalid_type_error: 'Please select a customer.'
    }),
    amount: z.coerce
        .number()
        .gt(0,{message:'Please enter an amount greater than $0.'}),
    status: z.enum(['pending','paid'],{
        invalid_type_error:'Please select an invoice status.'
    }),
    date: z.string()
});

const CreateInvoice = FormSchema.omit({id:true,date:true});

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

// -- CREATE INVOICE
export async function createInvoice(prevState: State, formData:FormData) {

    // Validate form using zod
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status')
    });

    // If form validation fails, returns errors early, otherwise continue.
    if(!validatedFields.success){
        return {
            errors:validatedFields.error.flatten().fieldErrors,
            message:'Missing fields. Failed to create invoice.'
        };
    };

    // Tip: If you're working with forms that have many fields, you may want to consider 
    // using the entries() method with JavaScript's Object.fromEntries().
    // https://nextjs.org/learn/dashboard-app/mutating-data

    // Prepare data to insert into the database
    const { customerId, amount, status } = validatedFields.data;
    // It's good practice to store monetary amounts in cents in databases
    const amountInCents = amount * 100;
    // Create a new date as a string, with format YYYY-MM-DD
    const date = new Date().toISOString().split('T')[0];

    // Insert data into the database
    try {
        await sql`
            INSERT INTO invoices (customer_id,amount,status,date)
            VALUES (${customerId},${amountInCents},${status},${date})
        `;    
    } catch (error) {
        // If a database error occurs, return a more specific error.
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    };

    // Revalidate the cache for the invoices page and redirect the user.
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');

};

// -- UPDATE INVOICE
// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, prevState: State, formData: FormData) {

    // Validate form using zod
    const validatedFields = UpdateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    // If form validation fails, returns errors early, otherwise continue.
    if(!validatedFields.success){
        return {
            errors:validatedFields.error.flatten().fieldErrors,
            message:'Missing fields. Failed to update invoice.'
        };
    };

    // If validation is successful, prepare data to update database
    const { customerId, amount, status } = validatedFields.data;
    const amountInCents = amount * 100;
 
    // Update database
    try {
        await sql`
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
        `;  
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    };

    // Revalidate path / redirect user
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
    
};

// -- DELETE INVOICE
export async function deleteInvoice(id: string) {
    try {
        await sql`DELETE FROM invoices WHERE id=${id}`;
    } catch (error) {
        console.log(error);
    };
    revalidatePath('/dashboard/invoices');    
};