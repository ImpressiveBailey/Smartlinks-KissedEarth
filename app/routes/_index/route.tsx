import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";
import indexStyles from "./style.css";

export const links = () => [{ rel: "stylesheet", href: indexStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return json({ showForm: Boolean(login) });
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className="index">
      <div className="content">
        <h1>Related collection generator</h1>
        <p>
          Automatically generate related collections on your store with the help
          of ChatGPT
        </p>
        {showForm && (
          <Form method="post" action="/auth/login">
            <label>
              <span>Shop domain</span>
              <input type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button type="submit">Log in</button>
          </Form>
        )}
        <ul>
          <li>
            Updates metafield on your collections with related collections
          </li>
          <li>2 step process to generate and apply related collections</li>
          <li>Ability to customise related collections</li>
        </ul>
      </div>
    </div>
  );
}
